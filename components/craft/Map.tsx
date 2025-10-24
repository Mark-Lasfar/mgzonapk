// /home/mark/Music/my-nextjs-project-clean/components/craft/Map.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  width?: string;
  height?: string;
  markerText?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Map = ({
  latitude = 51.505,
  longitude = -0.09,
  zoom = 13,
  width = '100%',
  height = '400px',
  markerText = 'Our Location',
  style = {},
  settings = {},
}: MapProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}
      style={{
        width,
        height,
        ...style,
        ...settings.style,
      }}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[latitude, longitude]}>
          <Popup>{markerText}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

Map.craft = {
  displayName: 'Map',
  props: {
    latitude: 51.505,
    longitude: -0.09,
    zoom: 13,
    width: '100%',
    height: '400px',
    markerText: 'Our Location',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};