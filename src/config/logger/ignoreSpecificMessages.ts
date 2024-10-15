import { format } from 'winston';

export const ignoreSpecificMessages = format((info) => {
  const messagesToIgnore = [
    "(setting 'href')",
    '__name is not defined',
    ' missing /',
    'GetGeoComment',
  ];

  if (messagesToIgnore.some((msg) => info.message.includes(msg))) {
    return false;
  }
  return info;
});
