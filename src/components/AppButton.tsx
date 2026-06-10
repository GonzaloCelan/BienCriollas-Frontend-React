import type { ButtonHTMLAttributes, ReactNode } from "react";

import "../styles/appButton.css";

type AppButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type AppButtonSize = "sm" | "md" | "lg";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
};

function AppButton({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  className = "",
  type = "button",
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={`app-button app-button--${variant} app-button--${size} ${
        fullWidth ? "app-button--full" : ""
      } ${className}`}
      {...props}
    >
      {icon && <span className="app-button__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export default AppButton;