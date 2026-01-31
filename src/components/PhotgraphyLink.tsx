import { useState } from "react";

export default function InstaLink() {
  const [hover, setHover] = useState(false);

  const style = {
    color: hover ? "#ff8c42" : "#ff6a00", // two shades of orange
    textDecoration: "none",
    display: "inline-block",
    transition: "all 0.25s ease",
    transform: hover ? "scale(1.08)" : "scale(1)",
    cursor: "pointer",
  };

  return (
    <a
      target="new"
      href="https://www.instagram.com/clicks.and.chaos.by.arp"
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <b>photography skills</b>
    </a>
  );
}
