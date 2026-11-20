import { useState } from "react";

export function CalendarInput({
  value = "",
  name,
  required = true,
  onChange,
}: {
  value?: string;
  name?: string;
  required?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
}) {
  const [selected, setSelected] = useState(value);
  const current = onChange ? value : selected;
  const [month, setMonth] = useState(
    (value || new Date().toISOString()).slice(0, 7),
  );
  const [open, setOpen] = useState(false);
  function change(next: string) {
    setSelected(next);
    onChange?.({ target: { value: next } });
  }
  const [year, m] = month.split("-").map(Number);
  const offset = new Date(year, m - 1, 1).getDay();
  const days = new Date(year, m, 0).getDate();
  function move(delta: number) {
    const next = new Date(year, m - 1 + delta, 1);
    setMonth(
      next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0"),
    );
  }
  return (
    <span className="calendar-input">
      <input type="hidden" name={name} value={current} />
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {current ? current.replace("T", " ") : "날짜와 시간 선택"}
      </button>
      {open && (
        <span className="calendar-panel">
          <span className="calendar-heading">
            <button type="button" aria-label="이전 달" onClick={() => move(-1)}>
              ‹
            </button>
            <strong>
              {year}년 {m}월
            </strong>
            <button type="button" aria-label="다음 달" onClick={() => move(1)}>
              ›
            </button>
          </span>
          <span className="calendar-grid">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <small key={d}>{d}</small>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={"blank" + i} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = month + "-" + String(i + 1).padStart(2, "0");
              return (
                <button
                  type="button"
                  key={date}
                  aria-label={date}
                  aria-pressed={current.startsWith(date)}
                  onClick={() =>
                    change(date + "T" + (current.split("T")[1] || "09:00"))
                  }
                >
                  {i + 1}
                </button>
              );
            })}
          </span>
          <span>
            시간{" "}
            <input
              aria-label="시간"
              type="time"
              required={required}
              value={current.split("T")[1] || "09:00"}
              onChange={(e) =>
                change(
                  (current.split("T")[0] || month + "-01") +
                    "T" +
                    e.target.value,
                )
              }
            />
          </span>
          <button
            type="button"
            className="button secondary"
            onClick={() => setOpen(false)}
          >
            선택 완료
          </button>
        </span>
      )}
    </span>
  );
}
