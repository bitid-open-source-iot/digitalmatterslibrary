// const { reporters } = require('mocha');
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
                SIG: 0,
                ExternalVoltage: 0,
                InternalTemperature: 0
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
        let arrShapedData = []
        if(response.arrBufAllData?.length > 0){
            response.arrBufAllData.map((async allData => {
                bFound = true
                let shapedData = {
                    values: {}
                }
                shapedData.values.TxFlag = allData.messageDetails.logReason
    
                shapedData.values.time = allData.messageDetails.deviceTime
                shapedData.values.sequenceNumber = allData.messageDetails.sequenceNumber
    
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
                            shapedData.values.gpsData = gpsData
                            break
                        case (2): //Digital Data
                            shapedData.values.digitalsIn = field.fIdData.readUInt32LE(0) //4 bytes
                            shapedData.values.digitalsOut = field.fIdData.readInt16LE(4) //2 bytes
                            shapedData.values.CI8 = field.fIdData.readInt16LE(6) //2 bytes
                            break
                        case (6): //Ananlog Data 16bit
                            for (let i = 0; i < field.fIdData.length; i++) {
                                if(field.fIdData[i] == 1){
                                    shapedData.values.BATT = field.fIdData.readInt16LE(i + 1) / 1000
                                }
                                if(field.fIdData[i] == 2){
                                    shapedData.values.ExternalVoltage = (field.fIdData.readInt16LE(i + 1) / 1000) / 10
                                }
                                if(field.fIdData[i] == 3){
                                    shapedData.values.InternalTemperature = field.fIdData.readInt16LE(i + 1) / 100
                                }
                                if(field.fIdData[i] == 4){
                                    shapedData.values.SIG = field.fIdData.readInt16LE(i + 1)
                                }
                                if (field.fIdData.readUInt8(i) > 4) {
                                //     shapedData.values[`AIExt${field.fIdData[i]}`] = field.fIdData.readInt16LE(i + 1)
                                // } else {
                                    shapedData.values[`AI${field.fIdData[i]}`] = field.fIdData.readInt16LE(i + 1)
                                }
                                i = i + 2
                            }
                            break
                        case (7): //Ananlog Data 32bit
                            for (let i = 0; i < field.fIdData.length; i++) {
                                try{
                                    shapedData.values[`AI${field.fIdData[i]}`] = field.fIdData.readInt32LE(i + 1)
                                }catch(e){
                                    console.error(`Analog Data 32 bit error for field.fIdData[i] ${field.fIdData[i]}`, e)
                                }
                                i = i + 4
                            }
                            break
                        default:
                            console.error('digitalMattersFalcon2GDriver Unhandled splitMultipleRecordsData case fId', fId)
                    }
                })
                arrShapedData.push(shapedData)
            }))
            response.arrShapedData = arrShapedData
            deferred.resolve(response)
        }else{
            deferred.resolve(response)
        }
    } catch (e) {
        console.error('digitalMattersFalcon2GDriver processData Error', e)
        deferred.reject(e)
    }

    return deferred.promise
}

exports.processTime = async function (digitalMattersTS) {
    var deferred = Q.defer()

    let PROTOCOL = require('./lib/protocol.js')
    let driver = new PROTOCOL()

    try {
        let dmDate = await driver.processTime(digitalMattersTS)
        deferred.resolve(dmDate)
    } catch (e) {
        console.error('digitalMattersFalcon2GDriver processTime Error', e)
        deferred.reject(e)
    }

    return deferred.promise

}