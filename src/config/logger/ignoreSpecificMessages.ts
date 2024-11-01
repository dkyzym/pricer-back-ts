import { format } from 'winston';

export const ignoreSpecificMessages = format((info) => {
  const messagesToIgnore = [
    "(setting 'href')",
    '__name is not defined',
    ' missing /',
    'GetGeoComment',
    'img',
    'yandex',
    'ya',
    'getfile',
    'lottiefiles',
    'favicon',
    'galleyp',
    'search.tips',
    'ERR_ABORTED',
    'nodacdn',
    'png',
    'gif',
    'jpg',
    '302',
    '301',
    'fonts',
  ];

  if (messagesToIgnore.some((msg) => info.message.includes(msg))) {
    return false;
  }
  return info;
});
