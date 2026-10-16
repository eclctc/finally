/** Chart time labels, local time, fixed en-US. */

const clock = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const dateClock = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const hourMinute = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export const formatClock = (t: number) => clock.format(t);
/** "Oct 16, 14:32:05" */
export const formatDateClock = (t: number) => dateClock.format(t);
/** "14:32" */
export const formatHourMinute = (t: number) => hourMinute.format(t);
/** "Oct 16" */
export const formatMonthDay = (t: number) => monthDay.format(t);
