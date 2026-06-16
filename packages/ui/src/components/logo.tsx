import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 12H4V4H12V12Z" fill="var(--icon-weak-base)" />
      <path
        data-slot="logo-logo-mark-v"
        d="M4 0H0V16H4V0ZM16 0H12V16H16V0ZM12 16H4V20H12V16Z"
        fill="var(--icon-strong-base)"
      />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 60H20V20H60V60Z" fill="var(--icon-base)" />
      <path d="M20 0H0V80H20V0ZM80 0H60V80H80V0ZM60 80H20V100H60V80Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 114 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        {/* V */}
        <path d="M18 24H6V12H18V24Z" fill="var(--icon-weak-base)" />
        <path d="M6 6H0V30H6V6ZM24 6H18V30H24V6ZM18 30H6V36H18V30Z" fill="var(--icon-base)" />
        {/* R */}
        <path d="M48 12H36V18H48V12Z" fill="var(--icon-weak-base)" />
        <path d="M54 6H30V36H36V24H48V18H54V6ZM48 12V18H36V12H48ZM48 24H54V36H48V24Z" fill="var(--icon-base)" />
        {/* A */}
        <path d="M78 12H66V18H78V12Z" fill="var(--icon-weak-base)" />
        <path d="M84 6H60V36H66V24H78V36H84V6ZM78 12V18H66V12H78Z" fill="var(--icon-strong-base)" />
        {/* X */}
        <path d="M108 18H96V24H108V18Z" fill="var(--icon-weak-base)" />
        <path
          d="M96 6H90V18H96V6ZM114 6H108V18H114V6ZM108 18H96V24H108V18ZM96 24H90V36H96V24ZM114 24H108V36H114V24Z"
          fill="var(--icon-strong-base)"
        />
      </g>
    </svg>
  )
}
