import Image from 'next/image';
import React from 'react';

export default function CenteredLogo() {
  return (
    <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
      <Image src="/photos/8.png" alt="Return Logo" width={150} height={50} className="object-contain" priority />
    </div>
  );
}
