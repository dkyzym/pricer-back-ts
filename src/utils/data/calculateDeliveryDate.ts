import { DateTime } from 'luxon';
import { SearchResultsParsed } from '../../types';

// import { DateTime } from 'luxon';
export function calculateDeliveryDate(
  result: SearchResultsParsed,
  currentTime: DateTime
): string {
  let deliveryDate: DateTime;

  if (result.warehouse === 'РД-3') {
    if (currentTime.hour < 12) {
      deliveryDate = currentTime;
    } else {
      deliveryDate = currentTime.plus({ days: 1 });
    }
  } else {
    // Parse 'deadLineTimeToOrder' to get hour and minute
    let deadlineHour = 0;
    let deadlineMinute = 0;
    if (result.deadLineTimeToOrder) {
      const [hourStr, minuteStr] = result.deadLineTimeToOrder.split(':');
      deadlineHour = parseInt(hourStr, 10);
      deadlineMinute = parseInt(minuteStr, 10);
    }

    let orderBeforeDeadline = false;

    if (
      currentTime.hour < deadlineHour ||
      (currentTime.hour === deadlineHour &&
        currentTime.minute <= deadlineMinute)
    ) {
      orderBeforeDeadline = true;
    }

    let daysToAdd = result.deadline;

    if (!orderBeforeDeadline) {
      daysToAdd += 1;
    }

    deliveryDate = currentTime.plus({ days: daysToAdd });
  }

  // Adjust for Sundays (weekday 7)
  while (deliveryDate.weekday === 7) {
    deliveryDate = deliveryDate.plus({ days: 1 });
  }

  // Format deliveryDate as 'yyyy:mm:dd'
  return deliveryDate.toFormat('yyyy-MM-dd');
}
