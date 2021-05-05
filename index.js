const { async } = require('q');
var Q = require('q');


exports.processData = async function (buf) {
    var deferred = Q.defer()


    try {
        let PROTOCOL = require('./lib/protocol.js')
        let driver = new PROTOCOL()

        let data = buf


        args = {
            "rtuId": -1, "data": data, "originalData": data, "values": {
                time: 0,
                TxFlag: 0,
                digitalsIn: 0,
                digitalsOut: 0,
                AI1: 0,
                AI2: 0,
                AI3: 0,
                AI4: 0,
                AIExt1: 0,
                AIExt2: 0,
                AIExt3: 0,
                AIExt4: 0,
                AIExt5: 0,
                AIExt6: 0,
                AIExt7: 0,
                AIExt8: 0,
                CI1: 0,
                CI2: 0,
                CI3: 0,
                CI4: 0,
                CI5: 0,
                CI6: 0,
                CI7: 0,
                CI8: 0,
                BATT: 0,
                SIG: 0
            }
        }

        let response = args
        response.data = data
        response.arrBufAllData = []

        response = await driver.splitRawData(response)
        for (let i = 0; i < response.arrBufRawData.length; i++) {
            response.message = response.arrBufRawData[i]
            response = await driver.processMessages(response)
        }


        let bFound = false
        response.arrBufAllData.map((async allData => {
            bFound = true
            response.values.TxFlag = allData.messageDetails.logReason

            var deviceTime = parseInt(new Date().getTime() / 1000 | 0)

            response.values.time = deviceTime

            allData.arrFields.map(async field => {
                switch (field.fId) {
                    case (0): //GPS Data
                        let gpsData = {
                            gpsUTCDateTime: field.fIdData.readUInt32LE(0),
                            latitude: field.fIdData.readInt32LE(4) / 10000000,   //155614102128
                            longitude: field.fIdData.readInt32LE(8) / 10000000,
                            altitude: field.fIdData.readInt16LE(12),
                            groundSpeed2D: field.fIdData.readUInt16LE(14),
                            speedAccuracyEstimate: field.fIdData.readUInt8(16),
                            heading2d: field.fIdData.readUInt8(17),
                            PDOP: field.fIdData.readUInt8(18),
                            positionAccuracyEstimate: field.fIdData.readUInt8(19),
                            gpsStatusFlags: field.fIdData.readUInt8(20),
                        }
                        // gpsData.gpsUTCDateTime = await processData(gpsData.gpsUTCDateTime)
                        gpsData.gpsUTCDateTime = new Date()
                        response.gpsData = gpsData
                        break
                    case (2): //Digital Data
                        response.values.digitalsIn = field.fIdData.readUInt32LE(0) //4 bytes
                        response.values.digitalsOut = field.fIdData.readInt16LE(4) //2 bytes
                        response.values.CI8 = field.fIdData.readInt16LE(6) //2 bytes
                        break
                    case (6): //Ananlog Data
                        for (let i = 0; i < 15; i++) {
                            if(field.fIdData[i] == 1){
                                response.values.BATT = field.fIdData.readInt16LE(i + 1) / 1000
                            }
                            if(field.fIdData[i] == 4){
                                response.values.SIG = field.fIdData.readInt16LE(i + 1)
                            }
                            if (field.fIdData.readUInt8(i) > 4) {
                                response.values[`AIExt${field.fIdData[i]}`] = field.fIdData.readInt16LE(i + 1)
                            } else {
                                response.values[`AI${field.fIdData[i]}`] = field.fIdData.readInt16LE(i + 1)
                            }
                            i = i + 2
                        }
                        break
                    default:
                        console.error('digitalMattersFalcon2GDriver Unhandled splitMultipleRecordsData case fId', fId)
                }

            })
        }))
        deferred.resolve(response)
    } catch (e) {
        console.error('digitalMattersFalcon2GDriver processData Error', e)
        deferred.reject(e)
    }

    return deferred.promise
}

exports.processDate = async function (digitalMattersTime) {
    var deferred = Q.defer()

    try {

        let timeBase = new Date('01/01/2013').getTime()
        let timeNow = Math.floor((new Date().getTime() - timeBase) / 1000)
        let timeBuf = Buffer.alloc(4)
        timeBuf.writeUInt32LE(timeNow)

        deferred.resolve(timeBuf.readUInt32LE())
    } catch (e) {
        console.error('digitalMattersFalcon2GDriver processDate Error', e)
        deferred.reject(e)
    }

    return deferred.promise

}