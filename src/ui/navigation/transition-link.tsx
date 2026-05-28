"use client";

import Link, { type LinkProps } from "next/link";
import * as React from "react";
import { useNavigationTransition } from "./navigation-transition";

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href">;

interface TransitionLinkProps extends LinkProps, AnchorProps {
  children: React.ReactNode;
}

function shouldUseNativeNavigation(event: React.MouseEvent<HTMLAnchorElement>, target?: string) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    target === "_blank"
  );
}

function toHrefString(href: LinkProps["href"]) {
  return typeof href === "string" ? href : href.toString();
}

export const TransitionLink = React.forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  ({ href, onClick, replace, target, children, ...props }, ref) => {
    const { navigate } = useNavigationTransition();

    return (
      <Link
        ref={ref}
        href={href}
        replace={replace}
        target={target}
        onClick={(event) => {
          onClick?.(event);
          if (shouldUseNativeNavigation(event, target)) return;

          event.preventDefault();
          navigate(toHrefString(href), replace ? "replace" : "push");
        }}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

TransitionLink.displayName = "TransitionLink";