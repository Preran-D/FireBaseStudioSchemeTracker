'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronLeft, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarContextProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean; // Will be false for this implementation
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(undefined);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SideContextWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false); // Default to collapsed (rail)
  const isMobile = false; // Simplified, not implementing mobile overlay for now

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

const sidebarVariants = cva(
  "fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
  {
    variants: {
      state: {
        open: "w-60", // Expanded width
        closed: "w-16", // Collapsed (rail) width
      },
    },
    defaultVariants: {
      state: "closed",
    },
  }
);

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof sidebarVariants> {}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = useSidebar();
    return (
      <aside
        ref={ref}
        data-state={isOpen ? "open" : "closed"}
        className={cn(sidebarVariants({ state: isOpen ? "open" : "closed" }), className)}
        {...props}
      >
        {children}
      </aside>
    );
  }
);
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = useSidebar();
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4 shrink-0", // Added shrink-0
          isOpen ? "justify-between" : "justify-center",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-y-auto p-2", className)} {...props}>
      {children}
    </div>
  )
);
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-auto border-t border-sidebar-border p-4 shrink-0", className)} // Added shrink-0
      {...props}
    >
      {children}
    </div>
  )
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, children, ...props }, ref) => (
    <ul ref={ref} className={cn("space-y-1", className)} {...props}>
      {children}
    </ul>
  )
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, children, ...props }, ref) => (
    <li ref={ref} className={cn("", className)} {...props}>
      {children}
    </li>
  )
);
SidebarMenuItem.displayName = "SidebarMenuItem";

interface SidebarMenuButtonProps extends React.HTMLAttributes<HTMLElement> {
  href?: string;
  icon?: React.ReactNode;
  tooltipLabel: string;
  children: React.ReactNode; // This will be the label text
  className?: string;
  isActive?: boolean; // Optional prop for active state
}

const SidebarMenuButton = React.forwardRef<HTMLElement, SidebarMenuButtonProps>(
  ({ href, icon, tooltipLabel, children, className, isActive, ...props }, ref) => {
    const { isOpen } = useSidebar();
    const Comp = href ? Link : 'button';

    const buttonContent = (
      <>
        {icon && <span className={cn("flex-shrink-0", isOpen ? "mr-3" : "mr-0")}>{icon}</span>}
        <span className={cn("truncate transition-opacity duration-200", isOpen ? "opacity-100" : "opacity-0 w-0")}>
          {children}
        </span>
      </>
    );

    const buttonElement = (
      // @ts-ignore TODO: Fix type for Comp with ref
      <Comp
        ref={ref}
        href={href!} // Assert href is present if Comp is Link
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'default' }),
          "w-full h-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
          isOpen ? "justify-start px-3" : "justify-center px-0",
          isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
          className
        )}
        {...(href ? {} : { type: 'button' })}
        {...props}
      >
        {buttonContent}
      </Comp>
    );

    if (!isOpen) {
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>{buttonElement}</TooltipTrigger>
            <TooltipContent side="right" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border shadow-lg">
              <p>{tooltipLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return buttonElement;
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, children, ...props }, ref) => {
    const { isOpen, setIsOpen } = useSidebar();
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("h-9 w-9 text-foreground hover:bg-accent/80", className)}
        onClick={() => setIsOpen(!isOpen)}
        {...props}
      >
        {isOpen ? <ChevronLeft className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        <span className="sr-only">{isOpen ? "Collapse sidebar" : "Expand sidebar"}</span>
      </Button>
    );
  }
);
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = useSidebar();
    return (
      <div
        ref={ref}
        className={cn(
          "transition-all duration-300 ease-in-out flex-1 flex flex-col", // Added flex-1 and flex-col
          isOpen ? "md:ml-60" : "md:ml-16", // Use md prefix for responsive margin
          "ml-0", // For mobile, sidebar might overlay or be hidden, so no margin
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarInset.displayName = "SidebarInset";

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
};
