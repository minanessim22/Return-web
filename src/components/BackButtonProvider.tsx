"use client";
import React, { createContext, useContext, useState } from "react";

type ContextType = {
  hidden: boolean;
  setHidden: (v: boolean) => void;
};

const BackButtonContext = createContext<ContextType>({ hidden: false, setHidden: () => {} });

export function BackButtonProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <BackButtonContext.Provider value={{ hidden, setHidden }}>
      {children}
    </BackButtonContext.Provider>
  );
}

export function useBackButtonContext() {
  return useContext(BackButtonContext);
}
