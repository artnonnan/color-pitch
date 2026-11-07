# 03 · แก้ไมค์บน iPhone: InvalidStateError (AudioSession category)

## ปัญหา
บน iPhone กดไมค์แล้วขึ้น `failed · InvalidStateError: AudioSession category is not compatible with audio capture`

## สาเหตุ
ตอนแตะครั้งแรกเพื่อเปิดเสียง แอปตั้ง `navigator.audioSession.type = "playback"` เพื่อให้มีเสียงแม้เปิดโหมดเงียบ
แต่ iOS ห้ามอัดเสียงในโหมด `playback` ไมค์จึงถูกปฏิเสธ

## แก้อะไร (`lib/pitch.ts`)
- ก่อนเรียก `getUserMedia` สลับเป็น `play-and-record`
- ถ้ายังเจอ `InvalidStateError` ให้ตั้งเป็น `auto` แล้วลองใหม่ 1 ครั้ง
- เมื่อปิดไมค์หรือเปิดไม่สำเร็จ สลับกลับเป็น `playback` (เพื่อให้เสียงยังดังตอนเปิดโหมดเงียบ)
- ถ้า iOS ยังไม่ยอม จะขึ้นข้อความสาเหตุ "audio-session" พร้อมวิธีแก้แทนคำว่า failed

## ตรวจแล้ว
- จำลองกติกาของ iOS ใน Edge (ปฏิเสธไมค์ด้วย InvalidStateError ขณะเป็น `playback`):
  ลำดับที่ได้คือ `playback → play-and-record → getUserMedia → playback`, วัด C4 ได้ 0.03 เซนต์, เสียงยังเล่นได้หลังปิดไมค์
- ยังไม่ได้ทดสอบบน iPhone จริง
