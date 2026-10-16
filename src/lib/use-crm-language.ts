import {useEffect,useState} from "react";
import {CRM_SETTINGS_LANGUAGE_STORAGE,normalizeCrmSettingsLanguage,type CrmSettingsLanguage} from "./settings-language";

/** Settings selection updates the whole CRM shell; storage events cover other tabs. */
export function useCrmLanguage():CrmSettingsLanguage {
  const read=():CrmSettingsLanguage=>{
    try{return normalizeCrmSettingsLanguage(localStorage.getItem(CRM_SETTINGS_LANGUAGE_STORAGE));}
    catch{return "th";}
  };
  const [language,setLanguage]=useState<CrmSettingsLanguage>(read);
  useEffect(()=>{
    const sync=()=>setLanguage(read());
    window.addEventListener("cpipos-crm-language-changed",sync);
    window.addEventListener("storage",sync);
    return()=>{
      window.removeEventListener("cpipos-crm-language-changed",sync);
      window.removeEventListener("storage",sync);
    };
  },[]);
  return language;
}
