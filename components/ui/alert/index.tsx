import React from "react";

interface AlertProps {
  children: React.ReactNode;
  variant?: "default" | "destructive";
}

export const Alert: React.FC<AlertProps> = ({ children, variant = "default" }) => {
  const variantClasses =
    variant === "destructive" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
  return (
    <div role="alert" className={`p-4 rounded ${variantClasses}`}>
      {children}
    </div>
  );
};

export const AlertTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <h4 className="font-semibold mb-2">{children}</h4>;
};

export const AlertDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <p>{children}</p>;
};