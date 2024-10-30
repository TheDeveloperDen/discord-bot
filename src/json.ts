import {Transaction} from '@sequelize/core'
// @ts-expect-error: Unreachable code error i dont remember why this is necessary but i'm scared to remove it

BigInt.prototype.toJSON = function (): string {
    return this.toString()
}


// @ts-expect-error ditto
Transaction.prototype.toJSON = function (): string {
    return '<Transaction>' // fixes circular reference
}

export function toJson(val: any): string {
    return JSON.stringify(val)
}
