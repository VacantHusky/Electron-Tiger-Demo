navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
class TigerWebRTC {
    constructor(options) {
        this.cid = options.cid;
        this.answer = 0;
        this.stunUrl = options.stunUrl || "https://test3.welincloud.com/web/stun.json";
        this.subject = 'private-video-room-' + this.cid;
        this.cameras = [];
        this.mics = [];
        this.is_join = false;
        this.can_close = true;
        this.initStun();
    }
    start() {
        if (this.cid == '' || this.cid == null) {
            alert("房间不存在！");
        } else {
            this.initVideo();
            let that = this;
            $(window).bind("TigerWebRTC_join", (options) => {
                if (that.is_join) { return }
                that.audioOption = options.audio == undefined ? true : options.audio;
                that.videoOption = options.video == undefined ? true : options.video;
                that.initWS();
            });  // 删除
        }
    }

    join(options) { // 加入房间
        if (this.is_join) { return }
        this.audioOption = options.audio == undefined ? true : options.audio;
        this.videoOption = options.video == undefined ? true : options.video;
        this.initWS();
    }

    initStun() { // 初始化stun
        let that = this;
        $.getJSON(this.stunUrl, (stuns) => {
            that.configuration = stuns;
            that.start();
        });
    }

    initVideo() {  // 初始化播放器
        this.localVideo = document.createElement("video");
        this.remoteVideo = document.createElement("video");
        this.localVideo.id = "localVideo";
        this.localVideo.setAttribute("autoplay", "true");
        this.localVideo.style.display = "none";
        this.remoteVideo.id = "remoteVideo";
        this.remoteVideo.setAttribute("autoplay", "true");
        this.remoteVideo.className = "hidden";
        this.remoteVideo.style.display = "none";
        document.body.appendChild(this.localVideo);
        document.body.appendChild(this.remoteVideo);
    }

    initWS() { // 建立与workerman的连接
        let that = this;
        this.is_join = true;
        this.ws = new WebSocket('wss://test3.welincloud.com/ws');
        this.ws.onopen = this.onopen();
        this.ws.onmessage = this.onmessage();
    }

    onopen() {
        let that = this;
        return () => {
            console.log("webRTC websocket 已连接");
            that.subscribe(that.subject);
            // 添加本地流
            navigator.mediaDevices.getUserMedia({
                audio: that.audioOption,
                video: that.videoOption,
            }).then(function (stream) {
                that.localVideo.srcObject = stream;
                that.localStream = stream;
                that.localVideo.addEventListener('loadedmetadata', function () {
                    that.publish('client-call', null);
                });
            }).catch(function (e) {
                alert(e);
            });
        }
    }

    onmessage() {
        let that = this;
        return (e) => {
            let package_ = JSON.parse(e.data);
            let data = package_.data;
            console.log("WebRTC 拉流 ", data ? data.candidate : "");
            console.log("WebRTC 事件 ", package_.event);
            switch (package_.event) {
                case 'client-call':
                    that.icecandidate(that.localStream);
                    that.pc.createOffer({
                        offerToReceiveAudio: 1,
                        offerToReceiveVideo: 1
                    }).then(function (desc) {
                        that.pc.setLocalDescription(desc).then(
                            function () {
                                that.publish('client-offer', that.pc.localDescription);
                            }
                        );
                    });
                    break;
                case 'client-answer':
                    that.pc.setRemoteDescription(new RTCSessionDescription(data));
                    break;
                case 'client-offer':
                    that.icecandidate(that.localStream);
                    that.pc.setRemoteDescription(new RTCSessionDescription(data));
                    if (!that.answer) {
                        that.pc.createAnswer(function (desc) {
                            that.pc.setLocalDescription(desc, function () {
                                that.publish('client-answer', that.pc.localDescription);
                            }, function (e) {
                                alert(e);
                            });
                        }, function (e) {
                            alert(e);
                        });
                        that.answer = 1;
                    }
                    break;
                case 'client-candidate':
                    that.pc.addIceCandidate(new RTCIceCandidate(data));
                    break;
            }
        }
    }

    close(close_cache) {
        if(close_cache?close_cache():true){
            try { this.pc.close(); } catch (error) { }
            if (this.localVideo) {
                this.localVideo.remove();
                this.localVideo = null;
            }
            if (this.remoteVideo) {
                this.remoteVideo.remove();
                this.remoteVideo = null;
            }
            if (this.ws && this.ws.readyState == 1)
                this.ws.close();
            this.ws = null;
            this.is_join = false;
            $(window).trigger("TigerWebRTC_close_after");
        }
    }

    icecandidate(localStream) {
        let that = this;
        this.pc = new RTCPeerConnection(this.configuration);
        this.pc.onconnectionstatechange = this.onconnectionstatechange();
        this.pc.ondatachannel = () => { console.log("pc.ondatachannel") };
        this.pc.onicecandidateerror = (e) => { console.log("pc.onicecandidateerror", e) };
        this.pc.ontrack = () => { console.log("pc.ontrack") };
        this.pc.onnegotiationneeded = () => { console.log("pc.onnegotiationneeded") };
        this.pc.onsignalingstatechange = () => { console.log("pc.onsignalingstatechange") };
        this.pc.onstatsended = () => { console.log("pc.onstatsended") };
        this.pc.onicecandidate = function (event) {
            console.log("pc.onicecandidate");
            if (event.candidate) {
                console.log("对方已连接？", event.candidate.candidate);
                $(window).trigger("TigerWebRTC_candidate");
                that.publish('client-candidate', event.candidate);
            }
        };
        try {
            this.pc.addStream(localStream);
        } catch (e) {
            let tracks = localStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                this.pc.addTrack(tracks[i], localStream);
            }
        }
        this.pc.onaddstream = function (e) {
            console.log("pc.onaddstream");
            that.remoteVideo.classList.remove("hidden");
            that.localVideo.remove();
            that.remoteVideo.srcObject = e.stream;
            $(window).trigger("TigerWebRTC_addstream", [e]);
        };
    }

    onconnectionstatechange() {
        let that = this;
        return (event) => {
            switch (that.pc.connectionState) {
                case "connected":
                    // 连接已完全连接
                    console.info("WebRTC 连接已建立");
                    $(window).trigger("TigerWebRTC_connected");
                    break;
                case "disconnected":
                    // 断开连接
                    console.info("WebRTC 连接已断开");
                    $(window).trigger("TigerWebRTC_disconnected");
                    break
                case "failed":
                    // 一个或多个传输意外终止或发生错误
                    console.info("WebRTC 连接意外终止");
                    $(window).trigger("TigerWebRTC_failed");
                    break;
                case "closed":
                    // 连接已关闭
                    console.info("WebRTC 连接已关闭");
                    $(window).trigger("TigerWebRTC_closed");
                    break;
            }
        }
    }

    publish(event, data) {  // 发送自己信息
        console.log("WebRTC 推流 ", data ? data.candidate : "");
        this.ws.send(JSON.stringify({
            cmd: 'publish',
            subject: this.subject,
            event: event,
            data: data
        }));
    }

    subscribe(subject) {  // 请求对方信息
        this.ws.send(JSON.stringify({
            cmd: 'subscribe',
            subject: subject
        }));
    }

    getUrlParam(name) {
        let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        let r = window.location.search.substr(1).match(reg);
        if (r != null) return unescape(r[2]);
        return null;
    }
}