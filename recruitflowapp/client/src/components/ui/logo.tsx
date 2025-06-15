import { Link } from "wouter";

interface LogoProps {
  className?: string;
  linkTo?: string;
}

export function Logo({ className = "", linkTo = "/" }: LogoProps) {
  const logoElement = (
    <img
      src="/src/assets/recruitflow-logo.svg"
      alt="RecruitFlow Logo"
      className={`h-10 ${className}`}
    />
  );

  // If we're using it as a link
  if (linkTo) {
    return (
      <div onClick={() => window.location.href = linkTo} className="cursor-pointer">
        {logoElement}
      </div>
    );
  }

  return logoElement;
}