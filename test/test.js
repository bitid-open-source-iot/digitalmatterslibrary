var chai = require('chai');
var expect = require('chai').expect;
// var assert = require('assert');

let biTidProtocol = require('../index')



let timeBase = new Date('01/01/2013').getTime()
let timeNow = Math.floor((new Date().getTime() - timeBase) / 1000)
let timeBuf = Buffer.alloc(4)
timeBuf.writeUInt32LE(timeNow)


describe('...', function () {
    describe('Hello from Device', function () {
        it('Expect Hello Response to send to Device', async function () {

            let serialNumber = Buffer.alloc(4)
            serialNumber.writeUInt32LE(65534)
            let helloToDevice = {
                sync1: Buffer.from([0x02]), //1 bytes
                sync2: Buffer.from([0x55]), //1 bytes
                msgType: Buffer.from([0x00]), //1 bytes
                payloadLen: Buffer.from([0x31, 0x00]), //2 bytes Little Endian
                serialNumber: Buffer.from(serialNumber), //4 bytes Little Endian
                modemIMEI: Buffer.from([0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61]),  //16 bytes ascii
                simSerial: Buffer.from([0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62, 0x62]), //21 bytes ascii
                productId: Buffer.from([0x01]), //1 byte
                hardwareRevisionNumber: Buffer.from([0x01]), //1 byte
                firmwareMajor: Buffer.from([0x01]), //1 byte
                firmwareMinor: Buffer.from([0x01]), //1 byte
                flags: Buffer.from([0x00, 0x00, 0x00, 0x00]), //4 bytes Little Endian
            }
            let finalBuf = Buffer.concat(Object.values(helloToDevice))

            response = await biTidProtocol.processData(finalBuf)
            // biTidProtocol.processData(finalBuf, function (response) {
            console.log('Hello Response', response)
            expect(response).to.have.property('responseToDevice')
            expect(response).to.have.property('values')
            // },function(err){
            //     console.log('error', err)
            // })
        });

        describe('DMT Message from Device', function () {
            it('Expect values in processed messages/s', async function () {
                let messagesToDevice = {
                    sync1: Buffer.from([0x02]), //1 bytes
                    sync2: Buffer.from([0x55]), //1 bytes
                    msgType: Buffer.from([0x04]), //1 bytes
                    payloadLen: Buffer.from([0x3d,0x00]), //2 bytes
                    record1Len: Buffer.from([0x3d,0x00]), //2 bytes
                    sequenceNumber: Buffer.from([0x47,0x46,0x00,0x00]), //4 bytes
                    rtcDateTime: Buffer.from(timeBuf),  //4 bytes
                    logReason: Buffer.from([0x0b]), //1 bytes
                    fId1: Buffer.from([0x00, 0x15]), //2 bytes
                    fId1Data: Buffer.from([0x02, 0xD4, 0x84, 0x02, 0xF0, 0x43, 0xF4, 0xEC, 0x2A, 0x69, 0x09, 0x45, 0x2B, 0x00, 0x1F, 0x00, 0x05, 0x00, 0x11, 0x23, 0x03]), //2 bytes. fId=0 GPS Data, Len 21 (0x15)
                    fId2: Buffer.from([0x02, 0x08]), //2 bytes. fId=2 Digital Data. Len 8
                    fId2Data: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00]), //8 bytes. (DI = 0, DO = 0, Status = 0x0A = b1010 = not in trip, Vbat OK, Vext not OK, Connected to GSM)
                    fId3: Buffer.from([0x06, 0x0f]), //2 bytes. (FID=6 Analogue Data, len = 15) 
                    fId3Data: Buffer.from([0x04 ,0x1D, 0x00, 0x01, 0xFE, 0x0F, 0x02, 0x1E, 0x00, 0x05, 0x00, 0x00, 0x03, 0xBF, 0x08]), //15 bytes. (analogue number + INT16 pairs)
                }
                let finalBuf = Buffer.concat(Object.values(messagesToDevice))

                // finalBuf = Buffer.from([2, 85, 4, 61, 0, 61, 0, 180, 0, 0, 0, 109, 217, 141, 15, 11, 0, 21, 109, 217, 141, 15, 44, 139, 55, 238, 50, 4, 124, 18, 67, 0, 0, 0, 5, 93, 19, 23, 3, 2, 8, 2, 0, 0, 0, 0, 0, 2, 0, 6, 15, 1, 199, 17, 3, 37, 8, 4, 28, 0, 5, 198, 17, 6, 11, 39])

                response = await biTidProtocol.processData(finalBuf)
                // biTidProtocol.processData(finalBuf, function (response) {
                    console.log('DMT Message Response', response)
                    expect(response).to.not.have.property('responseToDevice')
                    expect(response).to.have.property('arrBufAllData')
                    expect(response).to.have.property('gpsData')
                    expect(response.arrBufAllData[0]).to.have.property('arrFields')
                    expect(response).to.have.property('values')
                    expect(response.values.AI1).to.equal(4094)
                    expect(response.values.TxFlag).to.equal(11)
                // },function(err){
                //     console.log('error',err)
                // })
            })
        })


        describe('Commit Message from Device', function () {
            it('what should we expect here???', async function () {
                let messageFromDevice = {
                    sync1: Buffer.from([0x02]), //1 bytes
                    sync2: Buffer.from([0x55]), //1 bytes
                    msgType: Buffer.from([0x05]), //1 bytes
                    payloadLen: Buffer.from([0x00,0x00]), //2 bytes
                }
                let finalBuf = Buffer.concat(Object.values(messageFromDevice))

                let expectedCommitToDevice = {
                    sync1: Buffer.from([0x02]), //1 bytes
                    sync2: Buffer.from([0x55]), //1 bytes
                    msgType: Buffer.from([0x06]), //1 bytes
                    payloadLen: Buffer.from([0x00, 0x01]), //2 bytes
                    commitStatus: Buffer.from([0x01])
                }
        

                response = await biTidProtocol.processData(finalBuf)
                console.log('Commit Message Response', response)
                expect(response).to.have.property('responseToDevice')
                let a = response.responseToDevice.toString()
                let b = Buffer.concat(Object.values(expectedCommitToDevice)).toString()
                expect(a).to.equal(b)
                console.log('story')
            })
        })        


        describe('DM Time format', function () {
            it('what should we expect here???', async function () {
                response = await biTidProtocol.processDate(timeNow)
                console.log('Commit Message Response', response)
                expect(response).to.equal(1)
            })
        })        


    });
});

