const ping = require('ping')

const onRecievePing = function (pingResponse) {
  const lastResponseIsAlive = pingResponse.alive
  maybeNotify(lastResponseIsAlive)
  maybeChangeIcon(lastResponseIsAlive)
}

const doThePing = function (ip, call) {
  ping.promise.probe("127.0.0.1").then(onRecievePing)
}

module.exports = startToPing
