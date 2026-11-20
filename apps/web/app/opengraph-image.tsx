import { ImageResponse } from "next/og";

export const alt = "PriceVue — price history & comparison for Amazon.in and Flipkart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #0f172a 0%, #312e81 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800 }}>PriceVue</div>
        <div style={{ fontSize: 44, marginTop: 24, opacity: 0.9 }}>Price history & comparison for Amazon.in and Flipkart</div>
        <div style={{ fontSize: 32, marginTop: 40, opacity: 0.7 }}>Never overpay.</div>
      </div>
    ),
    size,
  );
}
