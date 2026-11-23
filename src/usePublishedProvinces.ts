import {useEffect, useState} from "react";
import {api} from "./api";
import {onPublicVillaRefresh} from "./publicVillaRefresh";
import {publishedProvinces} from "./publishedProvinces";
import {usePresentation} from "./cms";

export default function usePublishedProvinces() {
  const presentation = usePresentation();
  const [provinces, setProvinces] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => onPublicVillaRefresh(() => setRefresh(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    void api<{villas: {province: string; qrStatus: string}[]}>("/public/villas")
      .then(data => { if (active) setProvinces(publishedProvinces(data.villas)); })
      .catch(() => { if (active) setProvinces([]); });
    return () => { active = false; };
  }, [refresh]);
  return publishedProvinces(provinces.map(province => ({province, qrStatus:"ACTIVE"})), presentation.provinces);
}
