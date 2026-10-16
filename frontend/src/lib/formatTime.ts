/** Chart time labels, local time, fixed en-US. */

const clock = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export const formatClock = (t: number) => clock.format(t);
