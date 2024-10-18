import { DateTime } from 'luxon';

export const calculatePatriotDeliveryDate = (currentTime: DateTime): string => {
  let deliveryDate: DateTime;

  if (
    currentTime.hour < 11 ||
    (currentTime.hour === 11 && currentTime.minute < 30)
  ) {
    // Order before 11:30 - delivery today
    deliveryDate = currentTime;
  } else if (
    (currentTime.hour > 11 ||
      (currentTime.hour === 11 && currentTime.minute >= 30)) &&
    currentTime.hour < 20
  ) {
    // Order between 11:30 and 20:00 - delivery next day
    deliveryDate = currentTime.plus({ days: 1 });
  } else {
    // Orders after 20:00 - delivery in two days
    deliveryDate = currentTime.plus({ days: 2 });
  }

  // Adjust for no delivery days (Monday and Sunday)
  while (deliveryDate.weekday === 1 || deliveryDate.weekday === 7) {
    deliveryDate = deliveryDate.plus({ days: 1 });
  }

  // Format deliveryDate as 'yyyy:MM:dd'
  return deliveryDate.toFormat('yyyy-MM-dd');
};
