"use client";

import { useEffect, useRef } from "react";
import L, { type CircleMarker, type LayerGroup, type Map as LeafletMap } from "leaflet";

export type MapLead = {
  id: string;
  name: string;
  city: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location_precision?: "address" | "neighborhood" | "city" | "unknown" | string;
};

type LeadMapProps = {
  leads: MapLead[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
};

const defaultCenter: L.LatLngExpression = [-14.8619, -40.8444];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function markerColor(precision?: string) {
  if (precision === "address") return "#2463eb";
  if (precision === "neighborhood") return "#d8842c";
  return "#8997aa";
}

export default function LeadMap({ leads, selectedLeadId, onSelect }: LeadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Record<string, CircleMarker>>({});
  const selectRef = useRef(onSelect);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true }).setView(defaultCenter, 5);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;
    window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current = {};
    const visible = leads.filter((lead) => Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude));
    const bounds = L.latLngBounds([]);

    const groups = new Map<string, MapLead[]>();
    visible.forEach((lead) => {
      const key = lead.location_precision === "city" ? `${lead.latitude}:${lead.longitude}` : lead.id;
      groups.set(key, [...(groups.get(key) || []), lead]);
    });

    groups.forEach((group) => {
      const lead = group[0];
      const color = markerColor(lead.location_precision);
      const isAggregate = group.length > 1 || lead.location_precision === "city";
      const marker = L.circleMarker([lead.latitude as number, lead.longitude as number], {
        radius: isAggregate ? Math.min(19, 10 + Math.sqrt(group.length)) : 8,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: isAggregate ? 0.5 : 0.78,
      });
      const description = isAggregate
        ? `${group.length} restaurantes · localização aproximada pela cidade`
        : [lead.category, lead.address || "Localização aproximada"].filter(Boolean).join(" · ");
      marker.bindTooltip(`<strong>${escapeHtml(isAggregate ? lead.city : lead.name)}</strong><br>${escapeHtml(description)}`, { direction: "top", offset: [0, -6] });
      marker.on("click", () => selectRef.current(lead.id));
      marker.addTo(layer);
      group.forEach((item) => { markersRef.current[item.id] = marker; });
      bounds.extend([lead.latitude as number, lead.longitude as number]);
    });

    if (visible.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    } else if (visible.length === 1) {
      map.setView([visible[0].latitude as number, visible[0].longitude as number], 12);
    }
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [leads]);

  useEffect(() => {
    const map = mapRef.current;
    const lead = leads.find((item) => item.id === selectedLeadId);
    if (!map || !lead || !Number.isFinite(lead.latitude) || !Number.isFinite(lead.longitude)) return;
    map.setView([lead.latitude as number, lead.longitude as number], Math.max(map.getZoom(), 12), { animate: true });
    const marker = markersRef.current[lead.id];
    if (marker) {
      marker.setStyle({ radius: 11, weight: 3, fillOpacity: 1 });
      marker.openTooltip();
    }
    const seen = new Set<CircleMarker>();
    Object.entries(markersRef.current).forEach(([id, item]) => {
      if (id !== lead.id && item !== marker && !seen.has(item)) {
        seen.add(item);
        const color = markerColor(leads.find((candidate) => candidate.id === id)?.location_precision);
        item.setStyle({ radius: 8, weight: 2, fillOpacity: 0.78, color, fillColor: color });
      }
    });
  }, [leads, selectedLeadId]);

  return <div className="prospects-map-frame"><div className="prospects-map" ref={containerRef} aria-label="Mapa dos restaurantes cadastrados" /><div className="prospects-map-legend"><span><i className="legend-dot exact" />Ponto informado</span><span><i className="legend-dot approximate" />Cidade aproximada</span></div></div>;
}
