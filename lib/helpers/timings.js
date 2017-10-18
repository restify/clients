'use strict';

var NS_PER_SEC = 1e9;
var MS_PER_NS = 1e6;

/**
* Get duration in milliseconds from two process.hrtime()
* @function getHrTimeDurationInMs
* @param {Array} startTime - [seconds, nanoseconds]
* @param {Array} endTime - [seconds, nanoseconds]
* @returns {Number|null} durationInMs
*/
function getHrTimeDurationInMs (startTime, endTime) {
    if (startTime === null || endTime === null) {
        return null;
    }

    var secondDiff = endTime[0] - startTime[0];
    var nanoSecondDiff = endTime[1] - startTime[1];
    var diffInNanoSecond = secondDiff * NS_PER_SEC + nanoSecondDiff;

    return Math.round(diffInNanoSecond / MS_PER_NS);
}

/**
* Calculates HTTP timings
* @function getTimings
* @param {Object} eventTimes - Timings
* @param {Number} eventTimes.startAt - Request started
* @param {Number|undefined} eventTimes.dnsLookupAt - DNS resolved
* @param {Number} eventTimes.tcpConnectionAt - TCP connection estabilished
* @param {Number|undefined} eventTimes.tlsHandshakeAt - TLS handshake finished
* @param {Number} eventTimes.firstByteAt - First byte arrived
* @param {Number} eventTimes.endAt - Request ended
* @returns {Object} timings - { dnsLookup, tcpConnection, tlsHandshake,
*                               firstByte, contentTransfer, total }
*/
function getTimings (eventTimes) {
    return {
        // There is no DNS lookup with IP address, can be null
        dnsLookup: getHrTimeDurationInMs(
            eventTimes.startAt,
            eventTimes.dnsLookupAt
        ),
        tcpConnection: getHrTimeDurationInMs(
            eventTimes.dnsLookupAt || eventTimes.startAt,
            eventTimes.tcpConnectionAt
        ),
        // There is no TLS handshake without https, can be null
        tlsHandshake: getHrTimeDurationInMs(
            eventTimes.tcpConnectionAt,
            eventTimes.tlsHandshakeAt
        ),
        firstByte: getHrTimeDurationInMs((
            // There is no TLS/TCP Connection with keep-alive connection
            eventTimes.tlsHandshakeAt || eventTimes.tcpConnectionAt ||
                eventTimes.startAt),
            eventTimes.firstByteAt
        ),
        contentTransfer: getHrTimeDurationInMs(
            eventTimes.firstByteAt,
            eventTimes.endAt
        ),
        total: getHrTimeDurationInMs(eventTimes.startAt, eventTimes.endAt)
    };
}

module.exports = {
    getHrTimeDurationInMs: getHrTimeDurationInMs,
    getTimings: getTimings
};
