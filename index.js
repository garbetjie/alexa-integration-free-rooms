const fs = require('fs');
const Alexa = require('alexa-sdk');
const google = require('googleapis').google;

const handlers = {
    "FindFreeRooms": async function() {
        const slots = this.event.request.intent.slots;
        let region;

        try {
            console.log('slots.city', JSON.stringify(slots.city));
            if (slots.city.hasOwnProperty('resolutions')) {
                const resolved = slots.city.resolutions.resolutionsPerAuthority.find(rpa => rpa.status.code === 'ER_SUCCESS_MATCH');

                region = resolved.values[0].value.id;
            }
        } catch (e) {
            // void
        }

        console.log(`using region "${region}"`);

        try {
            console.log('about to call getAvailableRooms()');
            const freeRooms = await getAvailableRooms(region);
            let spokenRoomName;

            switch ((region || '').toString().toLowerCase()) {
                case 'cpt':
                    spokenRoomName = 'Cape Town';
                    break;

                case 'jhb':
                    spokenRoomName = 'Johannesburg';
                    break;
            }

            console.log('called getAvailableRooms()');
            console.log('Found the following free rooms: ' + JSON.stringify(freeRooms));

            if (freeRooms.length < 1) {
                this.response.speak(`There are no rooms available${spokenRoomName ? ' in ' + spokenRoomName : ''}.`);
            } else {
                this.response.speak(`Rooms available${spokenRoomName ? ' in ' + spokenRoomName : ''} are: ${freeRooms.join(', ')}`);
            }
        } catch (e) {
            console.error('Encountered error fetching free rooms: ' + e.message);
            this.response.speak(`Oops. I couldn't request the available rooms.`);

            throw e;
        }

        this.emit(':responseReady');
    },
    "Unhandled": function() {
        this.response.speak("I didn't understand the question.");
        this.emit(":responseReady");
    },
};

exports.handler = function (event, context, callback) {
    console.log('event: ', JSON.stringify(event));
    console.log('context: ', JSON.stringify(context));
    console.log('remaining ms: ', context.getRemainingTimeInMillis());

    const alexa = Alexa.handler(event, context);
    alexa.appId = process.env.ALEXA_SKILL_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};


async function getAvailableRooms(region) {
    console.log('creating read stream for service account');
    const readStream = fs.createReadStream('service-account.json');

    console.log('creating auth for google');
    const auth = await google.auth.fromStream(readStream);

    console.log('pushing scopes');
    auth.scopes = auth.scopes || [];
    auth.scopes.push('https://www.googleapis.com/auth/calendar.readonly');

    console.log('creating google calendar instance');
    const googleCalendar = google.calendar({ version: 'v3', auth });
    // console.log(calendar);

    console.log('listing all calendars');

    const calendars = (await googleCalendar.calendarList.list()).data.items;
    const now = Date.now();

    console.log(`Discovered following meeting rooms: \n - ${Object.values(calendars).map(c => c.summary).join('\n - ')}`);

    region = region || null;
    const regionMatchRegex = new RegExp(region ? `\\s+\\((${region})\\)` : `.+`, 'i');

    const eligibleCalendars = [];
    let resolve = null;
    let processFreeCalendars = new Promise(r => resolve = r);

    console.log('filtering calendars');

    const calendarsToCheck = calendars.filter(c => regionMatchRegex.test(c.summary));
    let remainingCalendars = calendarsToCheck.length;

    calendarsToCheck.forEach(
        async function(calendar) {
            console.log(`filtering calendar ${calendar.summary}`);
            console.log(`[${calendar.summary}] fetching event list`);

            const { data: eventList } = await googleCalendar.events.list({
                calendarId: calendar.id,
                singleEvents: true,
                orderBy: 'startTime',
                timeMax: (new Date(now + (24 * 60 * 60 * 1000))).toISOString(),
                timeMin: (new Date(now)).toISOString(),
            });

            console.log(`[${calendar.summary}] fetched event list`);
            console.log(`[${calendar.summary}] filtering event list`);

            const events = eventList.items.filter(
                event => {
                    if (event.status !== 'confirmed') {
                        return false;
                    }

                    let thisCalendarAttendee = (event.attendees || []).filter(a => a.email === calendar.id) ;
                    thisCalendarAttendee = thisCalendarAttendee.length > 0 ? thisCalendarAttendee[0] : null;

                    // Calendar didn't accept invite.
                    if (! thisCalendarAttendee || thisCalendarAttendee.responseStatus !== 'accepted') {
                        return false;
                    }

                    const startTimestamp = Date.parse(event.start.dateTime);
                    const endTimestamp = Date.parse(event.end.dateTime);

                    // Return event if it is happening now.
                    return startTimestamp < now && endTimestamp > now;
                }
            );

            console.log(`[${calendar.summary}] filtered events. got ` + events.length + ` events`);

            if (events.length < 1) {
                eligibleCalendars.push(calendar);
            }

            remainingCalendars--;

            if (remainingCalendars <= 0) {
                resolve(eligibleCalendars);
            }
        },
        {}
    );

    return processFreeCalendars.then(
        freeCalendars => {
            console.log('processing eligible calendars', freeCalendars.map(c => c.summary));

            return freeCalendars.map(c => c.summary.toString().replace(/\s+\([a-z]+\)$/i, ''));
        }
    );
}
