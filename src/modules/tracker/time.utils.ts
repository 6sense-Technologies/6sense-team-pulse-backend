export function calculateTimeSpent(start: Date, end: Date) {
  if (!start || !end) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  }

  const duration = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  return { hours, minutes, seconds, totalSeconds: duration };
}
