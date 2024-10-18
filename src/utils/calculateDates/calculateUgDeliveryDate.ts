import { DateTime } from 'luxon';
import { SearchResultsParsed } from 'types';

export const getNextDeliveryDateFrom = (date: DateTime): DateTime => {
  let deliveryDate = date;
  while (true) {
    if (deliveryDate.weekday === 1 || deliveryDate.weekday === 4) {
      return deliveryDate;
    }
    deliveryDate = deliveryDate.plus({ days: 1 });
  }
};

export const calculateDeliveryDate = (
  result: SearchResultsParsed,
  currentTime: DateTime
): string => {
  let deliveryDate: DateTime;

  if (result.deadLineMax > 0) {
    // For deadLineMax > 0, add deadLineMax days and find the next delivery day
    const tentativeDate = currentTime.plus({ hours: result.deadLineMax });
    deliveryDate = getNextDeliveryDateFrom(tentativeDate);
  } else {
    // For deadLineMax == 0
    if (currentTime.hour < 14) {
      // If order is made before 14:00, check for the next delivery day after tomorrow
      const tentativeDate = currentTime.plus({ days: 1 });
      deliveryDate = getNextDeliveryDateFrom(tentativeDate);
    } else {
      // If order is made after 14:00, delivery will be on the next delivery day after two days
      const tentativeDate = currentTime.plus({ days: 2 });
      deliveryDate = getNextDeliveryDateFrom(tentativeDate);
    }
  }

  // Format the deliveryDate as 'yyyy:MM:dd'
  return deliveryDate.toFormat('yyyy-MM-dd');
};
