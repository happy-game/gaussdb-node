const emptyBuffer = Buffer.allocUnsafe(0)

export type Endian = 'be' | 'le'

export class BufferReader {
  private buffer: Buffer = emptyBuffer

  // TODO(bmc): support non-utf8 encoding?
  private encoding: string = 'utf-8'

  constructor(
    private offset: number = 0,
    private endian: Endian = 'be'
  ) {}

  public setBuffer(offset: number, buffer: Buffer): void {
    this.offset = offset
    this.buffer = buffer
  }

  public int16(): number {
    const result = this.endian === 'le' ? this.buffer.readInt16LE(this.offset) : this.buffer.readInt16BE(this.offset)
    this.offset += 2
    return result
  }

  public uint16(): number {
    const result = this.endian === 'le' ? this.buffer.readUInt16LE(this.offset) : this.buffer.readUInt16BE(this.offset)
    this.offset += 2
    return result
  }

  public byte(): number {
    const result = this.buffer[this.offset]
    this.offset++
    return result
  }

  public peekByte(): number {
    return this.buffer[this.offset]
  }

  public int32(): number {
    const result = this.endian === 'le' ? this.buffer.readInt32LE(this.offset) : this.buffer.readInt32BE(this.offset)
    this.offset += 4
    return result
  }

  public uint32(): number {
    const result = this.endian === 'le' ? this.buffer.readUInt32LE(this.offset) : this.buffer.readUInt32BE(this.offset)
    this.offset += 4
    return result >>> 0
  }

  public uint64Parts(): { hi: number; lo: number } {
    let hi: number
    let lo: number
    if (this.endian === 'le') {
      lo = this.buffer.readUInt32LE(this.offset)
      hi = this.buffer.readUInt32LE(this.offset + 4)
    } else {
      hi = this.buffer.readUInt32BE(this.offset)
      lo = this.buffer.readUInt32BE(this.offset + 4)
    }
    this.offset += 8
    return { hi: hi >>> 0, lo: lo >>> 0 }
  }

  public remaining(): number {
    return this.buffer.length - this.offset
  }

  public string(length: number): string {
    const result = this.buffer.toString(this.encoding, this.offset, this.offset + length)
    this.offset += length
    return result
  }

  public cstring(): string {
    const start = this.offset
    let end = start
    // eslint-disable-next-line no-empty
    while (this.buffer[end++] !== 0) {}
    this.offset = end
    return this.buffer.toString(this.encoding, start, end - 1)
  }

  public bytes(length: number): Buffer {
    const result = this.buffer.slice(this.offset, this.offset + length)
    this.offset += length
    return result
  }
}
