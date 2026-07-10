import type { SVGProps } from "react";

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      focusable="false"
      {...props}
      aria-hidden="true"
    >
      <path fill="currentColor" d="M14 12H24V42H48V52H14Z" />
      <circle cx="45" cy="19" r="7" fill="currentColor" />
      <circle cx="34.5" cy="29" r="4" fill="currentColor" />
      <circle cx="28.5" cy="37.5" r="2.6" fill="currentColor" />
    </svg>
  );
}
