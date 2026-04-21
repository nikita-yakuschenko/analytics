import * as React from "react";
import { cn } from "@/lib/utils";

const TabsContext = React.createContext(null);

export function Tabs({ defaultValue, value: controlledValue, onValueChange, children }) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const setValue = (nextValue) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    if (onValueChange) {
      onValueChange(nextValue);
    }
  };

  return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
}

export function TabsList({ className, children }) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}

export function TabsTrigger({ value, className, children }) {
  const context = React.useContext(TabsContext);
  const active = context?.value === value;
  return (
    <button
      className={cn(
        "rounded-full px-3 py-1.5 text-sm text-[#3f4552]",
        active && "border border-[#8dbb49]",
        className
      )}
      onClick={() => context?.setValue(value)}
      type="button"
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }) {
  const context = React.useContext(TabsContext);
  if (context?.value !== value) return null;
  return <div className={className}>{children}</div>;
}
