var Q = require('q');


class protocol{
    constructor(){

    }

    async splitRawData(args) {
        var deferred = Q.defer();
        var self = this;
        let response = args

        response.arrBufRawData = []
        let bufData = Buffer.from(response.data)
        try {
            /**
             * Handle packets of data appended to each other
            */
            for (let i = 0; i < bufData.length - 1; i++) {
                try {
                    if (i < bufData.length - 3) {
                        if (bufData[i] == 0x02 && bufData[i + 1] == 0x55) {
                            let payloadLen = bufData.readUInt16LE(i + 3)
                            response.arrBufRawData.push(bufData.subarray(i, i + 5 + payloadLen))
                            i = i + payloadLen + 4
                        }
                    }
                } catch (e) {
                    console.error('digitalMattersFalcon2GDriver error in loop processMessages', e)
                }
            }

            deferred.resolve(response)
        } catch (e) {
            response.e = e.e || e
            deferred.reject(response)
        }

        return deferred.promise

    }

    async splitMultipleMessageData(args) {
        var deferred = Q.defer();
        var self = this;
        let response = args

        response.arrBufAllData = []

        try {
            /**
             * Separate multiple messages/DMT from arrBufRawData
            */
            for (let i = 0; i < response.arrBufRawData.length; i++) {
                let bufRawData = Buffer.from(response.arrBufRawData[i])
                try {
                    let payloadLenTotal = bufRawData.readUInt16LE(3)
                    for (let x = 5; x < payloadLenTotal; x++) {
                        let payloadLenMessage = bufRawData.readUInt16LE(x)
                        let bufMessage = bufRawData.slice(x, x + payloadLenMessage)
                        response.arrBufAllData.push({
                            bufRawData: response.arrBufRawData[i],
                            bufMessage: bufMessage,
                            arrFields: []
                        })
                        x = x + payloadLenMessage - 1
                    }
                    response = await self.splitMultipleRecordsData(response)
                    deferred.resolve(response)
                } catch (e) {
                    console.error('digitalMattersFalcon2GDriver error in loop splitMultipleMessageData', e)
                }
            }

            deferred.resolve(response)
        } catch (e) {
            response.e = e.e || e
            deferred.reject(response)
        }

        return deferred.promise

    }

    async processTime(digitalMattersTS){
        var deferred = Q.defer()

        try {
            let a = 1356998400 + digitalMattersTS
            deferred.resolve(a)
        } catch (e) {
            console.error('digitalMattersFalcon2GDriver processTime Error', e)
            deferred.reject(e)
        }
    
        return deferred.promise
    }

    async splitMultipleRecordsData(args) {
        var deferred = Q.defer();
        var self = this;
        let response = args

        try {
            for (let i = 0; i < response.arrBufAllData.length; i++) {
                let bufMessage = response.arrBufAllData[i].bufMessage
                let bufMessageMessageLen = bufMessage.readUInt16LE(0)
                let sequenceNumber = bufMessage.readUInt16LE(2)
                let rtcDateTime = bufMessage.readUInt32LE(6)
                let deviceTime = await self.processTime(rtcDateTime)
                let logReason = bufMessage.readUInt8(10)
                response.arrBufAllData[i].messageDetails = {
                    sequenceNumber: sequenceNumber,
                    rtcDateTime: rtcDateTime,
                    deviceTime: deviceTime,
                    logReason: logReason
                }
                for (let y = 11; y < bufMessage.length; y++) {
                    let fId = bufMessage.readUInt8(y)
                    let fIdLen = bufMessage.readUInt8(y + 1)
                    let fIdData = bufMessage.slice(y + 2, y + 2 + fIdLen)
                    y = y + 1 + fIdLen
                    response.arrBufAllData[i].arrFields.push({ 
                        fId: fId, 
                        fIdData: fIdData
                    })
                }
            }
            deferred.resolve(response)
        } catch (e) {
            response.e = e.e || e
            deferred.reject(response)
        }

        return deferred.promise
    }

    async processMessages(args) {
        var deferred = Q.defer()
        var self = this
        let response = args
        try {
            let finalBuf
            let buf = Buffer.from(response.message)
            response.msgType = buf[2].toString(16).padStart(2, '0').toUpperCase()
            response.msgType = '0x' + response.msgType
            switch (response.msgType) {
                case ('0x00'):    //Hello from Device
    
                    let helloFromDevice = {
                        sync1: buf.readUInt8(0), //1 bytes
                        sync2: buf.readUInt8(1), //1 bytes
                        msgType: buf.readUInt8(2), //1 bytes
                        payloadLen: buf.readUInt16LE(3), //2 bytes
                        serialNumber: buf.readUInt32LE(5), //4 bytes
                        modemIMEI: buf.slice(9, 16).toString(),  //16 bytes
                        simSerial: buf.slice(25, 21).toString(), //21 bytes
                        productId: buf.readUInt8(46), //1 byte
                        hardwareRevisionNumber: buf.readUInt8(47), //1 byte
                        firmwareMajor: buf.readUInt8(48), //1 byte
                        firmwareMinor: buf.readUInt8(49), //1 byte
                        flags: buf.readUInt32LE(50), //4 bytes
                    }
    
                    response.rtuId = helloFromDevice.serialNumber
    
                    let timeBase = new Date('01/01/2013').getTime()
                    let timeNow = Math.floor((new Date().getTime() - timeBase) / 1000)
                    let timeBuf = Buffer.alloc(4)
                    timeBuf.writeUInt32LE(timeNow)

                    let helloToDevice = {
                        sync1: Buffer.from([0x02]), //1 bytes
                        sync2: Buffer.from([0x55]), //1 bytes
                        msgType: Buffer.from([0x01]), //1 bytes
                        payloadLen: Buffer.from([0x08, 0x00]), //2 bytes
                        bufDateTime: Buffer.from(timeBuf), //4 bytes
                        code: Buffer.from([0x00, 0x00, 0x00, 0x00])
                    }
                    finalBuf = Buffer.concat(Object.values(helloToDevice))
                    response.responseToDevice = finalBuf
                    break
                case ('0x04'):
                    /**
                     * Data Record Upload from Device to Server. This can contain muiltiple records
                     * Data Extraction
                     * If there is data that the device has not yet sent, it will send it. Refer to the DMT data fields document for the data format:
                    */
                    response = await self.splitMultipleMessageData(response)
                    break
                case ('0x05'):
                    /**
                     * Commit Request
                     * A commit request will be sent from the device when data is sent. It waits for acknowledgement to ensure the data arrived and can be deleted
                    */
    
                    let commitRequestFromDevice = {
                        sync1: buf.readUInt8(0), //1 bytes
                        sync2: buf.readUInt8(1), //1 bytes
                        msgType: buf.readUInt8(2), //1 bytes
                        payloadLen: buf.readUInt16LE(3), //2 bytes
                    }
    
                    let commitToDevice = {
                        sync1: Buffer.from([0x02]), //1 bytes
                        sync2: Buffer.from([0x55]), //1 bytes
                        msgType: Buffer.from([0x06]), //1 bytes
                        payloadLen: Buffer.from([0x01, 0x00]), //2 bytes
                        commitStatus: Buffer.from([0x01]), //1 bytes
                    }
                    finalBuf = Buffer.concat(Object.values(commitToDevice))
                    response.responseToDevice = finalBuf
                    break
    
                case ('0x14'):
                    /**
                     * Version message
                    */
                     let versionFromDevice = {
                        sync1: buf.readUInt8(0), //1 bytes
                        sync2: buf.readUInt8(1), //1 bytes
                        msgType: buf.readUInt8(2), //1 bytes
                        payloadLen: buf.readUInt16LE(3), //2 bytes
                        serialNumber: buf.readUInt32LE(5), //4 bytes
                        canAddress: buf.readUInt32LE(9), //4 bytes
                        numberOfSlots: buf.readInt8(13), //1 byte
                        versionSlot1: buf.readUInt32LE(14), //4 bytes
                        versionSlot2: buf.readUInt32LE(18), //4 bytes
                        versionSlot3: buf.readUInt32LE(22), //4 bytes
                        versionSlot4: buf.readUInt32LE(26), //4 bytes
                    }
    
                    let bResponseRequired = false //SB! Need to find out how we know if need to respond or not...Documentation mentions 4G devices require response.
    
                    if(bResponseRequired == true){
                        let serialNumber = Buffer.alloc(4)
                        serialNumber.writeUInt32LE(versionFromDevice.serialNumber)
                        let versionResponseToDevice = {
                            sync1: Buffer.from([0x02]), //1 bytes
                            sync2: Buffer.from([0x55]), //1 bytes
                            msgType: Buffer.from([0x15]), //1 bytes
                            payloadLen: Buffer.from([0x0B, 0x00]), //2 bytes
                            serialNumber: Buffer.from(serialNumber), //4 bytes
                            canAddress: Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
                            reserved1: Buffer.from([0x00, 0x00]),
                            reserved2: Buffer.from([0x00, 0x00]),
                        }
                        finalBuf = Buffer.concat(Object.values(versionResponseToDevice))
                        response.responseToDevice = finalBuf
                    }
                    
                    break
    
                case ('0x26'):
                    /**
                     * Socket Closure. SB! Only some 4G variants send this.
                    */
                     let closureFromDevice = {
                        sync1: buf.readUInt8(0), //1 bytes
                        sync2: buf.readUInt8(1), //1 bytes
                        msgType: buf.readUInt8(2), //1 bytes
                        payloadLen: buf.readUInt16LE(3), //2 bytes
                    }
    
                default:
                    console.error('digitalMattersFalcon2GDriver unhandled msgType', msgType)
                    // objRes = { "strData": response.sock.unitAddress + ' ' + data, "objDataV1": null, "objDataV2": null }
                    // self.emit('broadcastListeners', objRes);
                    deferred.resolve(response);
                    break;
    
            }
    
            deferred.resolve(response)
    
        } catch (e) {
            response.e = e.e || e
            deferred.reject(response)
        }
    
        return deferred.promise
    }
}
module.exports = protocol






        // this.header = {
        //     sync1: 0x02,
        //     sync1: 0x55,
        //     msgType: 0x00,
        //     payloadLen: 0x00
        // }

        // this.msgTypesFromDevice = {
        //     hello: 0,
        //     sendDataRecords: 4,
        //     commitRequest: 5,
        //     versionData: 14,
        //     asyncMsgResponse: 21,
        //     requestAsyncSessionStart: 22,
        //     disconnectSocket: 26,
        //     timeRequest: 30
        // }

        // this.asyncMsgTypeClasses = {
        //     system: 0,
        //     application: 1
        // }

        // this.asyncMsgTypes = {
        //     reserved: 0x0,
        //     triggerVersionCheck: 0x0001,
        //     remoteReset: 0x0002,
        //     setOperationalMode: 0x0003,
        //     setDigitalOutput: 0x0004,
        //     setEnableSimPin: 0x0005,
        //     uploadAccidentData: 0x0006,
        //     connectToOEMforConfig: 0x0007,
        //     changeOrAddSystemParameter: 0x0008,
        //     deleteSystemParameter: 0x0009,
        //     deleteAllSsytemParameters: 0x0010,
        //     unlockFeature: 0x0011,
        //     setOdometer: 0x0012,
        //     setRunHours: 0x0013,
        //     modemReset: 0x0014,
        //     immobilise: 0x0000,
        //     reservedForGarmin: 'All',
        // }

        // this.operationalModes = {
        //     production: 0,
        //     normal: 1,
        //     shipping: 2,
        //     recovery: 3
        // }

        // this.setOperationalModeParameters = {
        //     operationalMode: this.operationalModes.production, //1 byte
        //     absoluteTime: new Date().getTime().toString() //4 bytes
        // }

        // this.logicLevels = {
        //     digitalOutput0: 0xb0,
        //     digitalOutput1: 0xb1,
        // }
        // this.logicLevelChangeMasks = {
        //     on: 1,
        //     off: 0
        // }
        // this.logicLevelStates = {
        //     on: 1,
        //     off: 0
        // }
        // this.setDigitalOutput = {
        //     logicLevel: this.logicLevelStates.off,
        //     changeMask: this.logicLevelChangeMasks.off
        // }

        // this.msgTypesToDevice = {
        //     helloResponse: 1,
        //     commitResponse: 6,
        //     ayncMsgRequest: 20,
        //     asyncSessionComplete: 23,
        //     timeResponse: 31
        // }

        // this.helloFromDevice = {
        //     header: this.header, //5 bytes
        //     serialNumber: '', //4 bytes
        //     modemIMEI: '',  //16 bytes
        //     simSerial: '', //21 bytes
        //     productId: 0, //1 byte
        //     hardwareRevisionNumber: 0, //1 byte
        //     firmwareMajor: 0, //1 byte
        //     firmwareMinor: 0, //1 byte
        //     flags: 0, //4 bytes
        // }

        // this.helloToDevice = {
        //     header: this.header,
        //     dateTime: new Date().getTime().toString(), //4 Bytes
        //     code: '', //4 bytes
        // }

        // this.dataExtractionFromDevice = {
        //     header: this.header, //5 bytes
        //     dmtDataFields: '', //X bytes
        // }

        // this.commitRequestFromDevice = {
        //     header: this.header //5 bytes. msgType 0x05
        // }

        // this.commitResponseToDevice = {
        //     header: this.header, //5 bytes. msgType 0x06
        // }

        // this.versionMsgFromDevice = {
        //     header: this.header, //5 bytes. msgType 0x14
        //     deviceSerialNumber: '', //4 bytes
        //     canAddress: '', //4 bytes. (0xFFFFFFFF for host)
        //     numberOfSlots: 0, //1 byte,
        //     slotData: '' //numberOfSlots x 4
        // }

        // this.versionResponseToDevice = {
        //     header: this.header, //5 bytes. msgType 0x15
        //     deviceSerialNumber: '', //4 bytes
        //     canAddress: '', //4 bytes. (0xFFFFFFFF for host)
        //     reserved1: 0x0000, //2 bytes,
        //     reserved2: 0x0000, //2 bytes,
        // }

        // this.timeRequestG100FromDevice = {
        //     header: this.header, //5 bytes. 0x30
        // }

        // this.timeResponseG100ToDevice = {
        //     header: this.header, //5 bytes. msgType 0x31
        //     currentTime: new Date().getTime().toString(), //4 bytes
        // }

        // this.socketCloseRequestFromDevice = {
        //     header: this.header, //5 bytes. msgType 0x26
        // }

        // this.deliveryStatus = {
        //     failure: 0,
        //     success: 1,
        //     retryLater: 2
        // }

        // this.asyncMsgToDevice = {
        //     header: this.header, //5 bytes. msgType 0x20
        //     msgId: 0, //4 bytes
        //     dmCANAddress: '', //4 bytes
        //     msgType: '', //2 bytes
        //     flags: 0, //1 byte
        //     payload: '', //N bytes
        // }

        // this.asyncMsgFromDevice = {
        //     header: this.header, //5 bytes. msgType 0x21
        //     msgId: 0, //4 bytes
        //     deliveryStatus: this.deliveryStatus.failure, //1 byte. 
        // }

        // this.sendQueuedAsyncMsgFromDevice = {
        //     header: this.header, //5 bytes. msgType 0x22
        // }

        // this.sendQueuedAsyncMsgResponseToDevice = {
        //     header: this.header, //5 bytes. msgType 0x23
        // }


    // init() {
    //     // var self = this;
    //     // setInterval(function(){
    //     //     self.heartbeat();
    //     // },60000);
    //     // setInterval(function(){
    //     //     self.setDate();
    //     // },(60*1000*60*24));
    // }

    // heartbeat() {
    //     var self = this;
    //     let args = {
    //         "type": self.type,
    //         "strData": "%9 LINK *"
    //     };
    //     self.emit('broadcastConnector', args);
    //     // self.emit('broadcastListeners', args);
    // }

    // setDate() {
    //     var self = this;
    //     let myDate = new DATE.module()
    //     let dateSA = myDate.stringDate(new Date(new Date().setHours(new Date().getHours() + 2)))
    //     let args = {
    //         "type": self.type,
    //         "strData": '%9 SET TIME = "' + dateSA + '" *'
    //     };
    //     self.emit('broadcastConnector', args);
    // }
