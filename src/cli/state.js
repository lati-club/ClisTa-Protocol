const {
  projectEvents,
  selectAudit,
  selectThreadState
} = require("../projector");
const {
  print,
  readValidEventsForOptions
} = require("./shared");

function stateShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectThreadState(projection, options.thread));
}

function auditShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectAudit(projection, options.thread));
}

module.exports = {
  auditShow,
  stateShow
};
