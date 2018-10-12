$(document).ready(function() {
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
        .then(onGetUserMedia)
        .catch(onFailedToGetUserMedia);
});

var localStream;

function onGetUserMedia(mediaStream) {
    console.log('success')
    localStream = mediaStream;
    document.querySelector('#localVideo').srcObject = mediaStream;
}

function onGetRemoteMedia(e) {
    console.log('Get remote!')
    let remoteView = document.querySelector('#remoteVideo');
    if (remoteView.srcObject !== e.streams[0]) {
        remoteView.srcObject = e.streams[0];
    }
}

function onFailedToGetUserMedia(e) {
    console.log(e);
}

var peerConnection;

function onMessage(msg) {
    console.log(msg);
    let data = JSON.parse(msg.body);
    if(data.data.cmd == 'call') {
        call(data.sender);
    }
    else if(data.sender != userId && data.data.cmd == 'candidate') {
        console.log("candidate!");
        peerConnection.addIceCandidate(data.data.data).then(() => console.log("AddIceCandidates")).catch(err => console.log("Ice Error: " + err));
    }
    else if(data.sender != userId && data.data.cmd == 'offer') {
        peerConnection.setRemoteDescription(data.data.data).then(function() {
            peerConnection.createAnswer().then(function(sdp) {
                peerConnection.setLocalDescription(sdp).then(function() {
                    sendToAll({'cmd': 'answer', 'data': sdp});
                });
            });
        });
        
    }
    else if(data.sender != userId && data.data.cmd == 'answer') {
        peerConnection.setRemoteDescription(data.data.data);
    }
}

function hostClick() {
    userId = 'host';
    let socket = new SockJS("https://toast-sig.run.goorm.io/ws");
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function() {
        console.log("connected!");

        stompClient.subscribe('/study/member', onMessage);
        stompClient.send('/study/send', {}, "{\"cmd\": \"msg\", \"data\": \"Host Connected!\"}");
    });
}

function remoteClick() {
    userId = 'remote';
    let socket = new SockJS("https://toast-sig.run.goorm.io/ws");
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function() {
        console.log("connected!");

        stompClient.subscribe('/study/member', onMessage);
        stompClient.send('/study/send', {}, "{\"cmd\": \"msg\", \"data\": \"Remote Connected!\"}");
    });
}

function connectClick() {
    sendToAll({'cmd': 'call'});
}

function sendToAll(data) {
    stompClient.send('/study/send', {}, JSON.stringify({'sender': userId, 'data': data}));
}

function call(caller) {
    peerConnection = new RTCPeerConnection({
        'iceServers': [
            {
                'urls': ['stun:stun.l.google.com:19302']
            },
            {
                'urls': ['turn:w1.xirsys.com:80?transport=udp'],
                'username': '35f846ee-be26-11e8-a7fe-35e8f7ade332',
                'credential': '35f84770-be26-11e8-b1ea-1c6f81131643'
            }
        ]
    });

    peerConnection.onicecandidate = onIceCandidate;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = onGetRemoteMedia;
    peerConnection.oniceconnectionstatechange = e => console.log('Ice Changed: ' + e);
    if(userId == 'host') {
        peerConnection.onnegotiationneeded = function() {
            peerConnection.createOffer({
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            })
            .then(function(sdp) {
                console.log("aaa!");
                peerConnection.setLocalDescription(sdp).then(function() {
                    sendToAll({'cmd': 'offer', 'data': sdp});
                });
            })
            .catch(function(err) {
                console.log(err);
            });
        }
    }
}

function onIceCandidate(e) {
    sendToAll({'cmd': 'candidate', 'data': e.candidate})
}