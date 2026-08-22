import { useState } from 'react';
export function CiProbe({ flag }: { flag: boolean }) {
  if (flag) {
    const [n] = useState(0);
    return <span>{n}</span>;
  }
  return null;
}
