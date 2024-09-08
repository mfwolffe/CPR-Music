'use client';

import * as React from 'react';

const MinimapContainer = function (hide) {
  const hidden = hide;

  return (
    <div
      className="w-100 ml-auto mr-auto mmap-container"
      id="mmap"
      hidden={hidden}
    />
  );
};

export { MinimapContainer };
