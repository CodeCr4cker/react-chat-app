import React, { createContext, useState, useContext } from "react";

const AboutUsContext = createContext();

export function AboutUsProvider({ children }) {
  const [about, setAbout] = useState("");
  const [logoURL, setLogoURL] = useState("");
  const [aboutPhotoURL, setAboutPhotoURL] = useState("");
  const [devGlowColor, setDevGlowColor] = useState("");
  const updateAboutUs = (data) => {
    if (data.about !== undefined) setAbout(data.about);
    if (data.logoURL !== undefined) setLogoURL(data.logoURL);
    if (data.aboutPhotoURL !== undefined) setAboutPhotoURL(data.aboutPhotoURL);
    if (data.devGlowColor !== undefined) setDevGlowColor(data.devGlowColor);
  };

  return (
    <AboutUsContext.Provider value={{
      about, setAbout,
      logoURL, setLogoURL,
      aboutPhotoURL, setAboutPhotoURL,
      devGlowColor, setDevGlowColor,
      updateAboutUs,
    }}>
      {children}
    </AboutUsContext.Provider>
  );
}

export function useAboutUs() {
  return useContext(AboutUsContext);
}