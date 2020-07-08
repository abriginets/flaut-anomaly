/**
 * Core Modules
 */

/**
 * Engine Modules
 */

import { WebSocketTransfer } from '../../types'

import { showErrorToast, showSuccessToast } from './components/toast'
import {
    setAuthorizationSucceeded,
    setAuthorizationFailed,
    setAuthenticationFailed,
    setAuthenticationSucceeded
} from './slices/auth'

import { setLatest, addLatest, setEntryStatus, addNewImage, removeImage } from './slices/dashboard'


import store from './store'

/**
 * Logic
 */

const newEntrySound = new Audio('/static/notify.mp3')
newEntrySound.volume = 0.20

const onOpen = (): void => (console.log('Websocket connection established!'))

const onMessage = (ev: MessageEvent): void => {
    if (typeof ev.data === 'string') {
        const message: WebSocketTransfer.ClientIncoming = JSON.parse(ev.data)
        const state = store.getState()

        if (message.type === 'authorization') {
            if (message.data.result === 'error') {
                showErrorToast(message.data.reason)
                store.dispatch(setAuthorizationFailed())
            } else {
                localStorage.setItem('jwt', message.data.payload.jwt)
                localStorage.setItem('uuid', message.data.payload.uuid)
                showSuccessToast('Authorization successful', 2000)

                setTimeout(() => {
                    store.dispatch(setAuthorizationSucceeded())
                }, 2000)
            }
        } else if (message.type === 'authentication') {
            if (message.data.result === 'error') {
                if (message.data.reason === 'JWT token expired, please sign in') {
                    localStorage.removeItem('jwt')
                }

                showErrorToast(message.data.reason)
                store.dispatch(setAuthenticationFailed())
            } else {
                store.dispatch(setAuthenticationSucceeded())
            }
        }

        if (state.auth.isAuthenticated && state.auth.isAuthorized) {
            if (message.type === 'upload-image') {
                if (window.awaitingUploadNotification) {
                    if (message.data.result === 'error') {
                        showErrorToast(message.data.reason)
                    } else {
                        store.dispatch(addNewImage(message.data))
                        showSuccessToast(`Image '${message.data.image.name}' uploaded`)
                    }
    
                    delete window.awaitingUploadNotification
                }
            } else if (message.type === 'delete-image') {
                if (window.awaitingDeletionNotification) {
                    if (message.data.result === 'error') {
                        showErrorToast(message.data.reason)
                    } else {
                        store.dispatch(removeImage(message.data))
                        showSuccessToast(`Image ${message.data.name} has been deleted`)
                    }
    
                    delete window.awaitingDeletionNotification
                }
            } else if (message.type === 'latest-entries') {
                store.dispatch(setLatest(message.data))
            } else if (message.type === 'new-entry') {
                newEntrySound.play()
    
                store.dispatch(addLatest(message.data.entry))
            } else if (message.type === 'entry-status-update') {
                store.dispatch(setEntryStatus(message.data))
            }
        }
    } else {
        console.log(ev.data)
    }
}

const onClose = (): void => {
    console.log('Websocket connection broke! Restoring...')
    setTimeout(window.startWebSocket, 1000)
}

const onError = (ev: Event): void => {
    console.error('Websocket errored: ', ev)
    window.ws.close()
}

export function init(): void {
    window.startWebSocket = function(): void {
        const isDev = ['localhost', '127.0.0.1'].includes(document.location.hostname)
        const proto = document.location.protocol === 'https:' ? 'wss' : 'ws'
        window.ws = new WebSocket(isDev ? 'ws://localhost:8888' : `${proto}://${document.location.hostname}/ws`)

        window.ws.onopen = onOpen
        window.ws.onclose = onClose
        window.ws.onmessage = onMessage
        window.ws.onerror = onError
    }
}

export const sendWebSocketData = (data: object): void => window.ws.send(JSON.stringify(data))
