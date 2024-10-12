export enum XBoxButton {
  XUSB_GAMEPAD_DPAD_UP            = 0x0001,
  XUSB_GAMEPAD_DPAD_DOWN          = 0x0002,
  XUSB_GAMEPAD_DPAD_LEFT          = 0x0004,
  XUSB_GAMEPAD_DPAD_RIGHT         = 0x0008,
  XUSB_GAMEPAD_START              = 0x0010,
  XUSB_GAMEPAD_BACK               = 0x0020,
  XUSB_GAMEPAD_LEFT_THUMB         = 0x0040,
  XUSB_GAMEPAD_RIGHT_THUMB        = 0x0080,
  XUSB_GAMEPAD_LEFT_SHOULDER      = 0x0100,
  XUSB_GAMEPAD_RIGHT_SHOULDER     = 0x0200,
  XUSB_GAMEPAD_GUIDE              = 0x0400,
  XUSB_GAMEPAD_A                  = 0x1000,
  XUSB_GAMEPAD_B                  = 0x2000,
  XUSB_GAMEPAD_X                  = 0x4000,
  XUSB_GAMEPAD_Y                  = 0x8000,
}

export const xboxButtonMap: { [index: number]: XBoxButton } = {
  0: XBoxButton.XUSB_GAMEPAD_A,
  1: XBoxButton.XUSB_GAMEPAD_B,
  2: XBoxButton.XUSB_GAMEPAD_X,
  3: XBoxButton.XUSB_GAMEPAD_Y,
  4: XBoxButton.XUSB_GAMEPAD_LEFT_SHOULDER,
  5: XBoxButton.XUSB_GAMEPAD_RIGHT_SHOULDER,
  8: XBoxButton.XUSB_GAMEPAD_BACK,
  9: XBoxButton.XUSB_GAMEPAD_START,
  10: XBoxButton.XUSB_GAMEPAD_LEFT_THUMB,
  11: XBoxButton.XUSB_GAMEPAD_RIGHT_THUMB,
  12: XBoxButton.XUSB_GAMEPAD_DPAD_UP,
  13: XBoxButton.XUSB_GAMEPAD_DPAD_DOWN,
  14: XBoxButton.XUSB_GAMEPAD_DPAD_LEFT,
  15: XBoxButton.XUSB_GAMEPAD_DPAD_RIGHT,
  16: XBoxButton.XUSB_GAMEPAD_GUIDE,
};

export class XBoxReport {
  readonly MAX_SIZE: number = 12;

  buttons = 0;          // 2 bytes
  leftTrigger = 0;      // 1 byte
  rightTrigger = 0;     // 1 byte
  leftThumbStickX = 0;  // 2 bytes
  leftThumbStickY = 0;  // 2 bytes
  rightThumbStickX = 0; // 2 bytes
  rightThumbStickY = 0; // 2 bytes

  toBuffer(): Uint8Array {
    const buffer = new ArrayBuffer(this.MAX_SIZE);
    const view = new DataView(buffer);

    view.setUint16(0, this.buttons);
    view.setUint8(2, this.leftTrigger);
    view.setUint8(3, this.rightTrigger);
    view.setInt16(4, this.leftThumbStickX);
    view.setInt16(6, this.leftThumbStickY);
    view.setInt16(8, this.rightThumbStickX);
    view.setInt16(10, this.rightThumbStickY);

    return new Uint8Array(buffer);
  }
}
