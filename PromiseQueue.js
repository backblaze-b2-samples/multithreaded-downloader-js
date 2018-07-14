// https://github.com/e-e-e/a-promise-queue
// Removed priority, flush, and promise flavour

class PromiseQueue {
  constructor (options) {
    Object.assign(this, options)
    this.onFinish = this.onFinish ? this.onFinish.bind(this) : () => {}
    this.concurrency = this.concurrency ? this.concurrency : 1
    this.promises = []
    this.queue = []
  }

  add (fn, options) {
    if (typeof fn !== 'function') {
      throw new Error('Expected a function as an argument.')
    }

    return new Promise((resolve, reject) => {
      const attempts = (options && options.attempts && options.attempts > 0) ? options.attempts : 1
      const onFinish = (options && options.onFinish) ? options.onFinish.bind(this) : () => {}

      if (this.promises.length < this.concurrency) {
        const id = this.promises.length ? this.promises[this.promises.length - 1].id + 1 : 1
        this.promises.push({id: id, promise: this._wrap(fn, id, resolve, reject, attempts, onFinish)})
      } else {
        this.queue.push({fn, attempts, resolve, reject, onFinish})
      }
    })
  }

  _promised (fn) {
    try {
      return Promise.resolve(fn())
    } catch (error) {
      return Promise.reject(error)
    }
  }

  _next (id) {
    if (this.signal.aborted) {
      return true
    }

    if (this.queue.length > 0) {
      const nextFn = this.queue.shift()
      return this._wrap(nextFn.fn, id, nextFn.resolve, nextFn.reject, nextFn.attempts)
    }

    const promiseId = this.promises.findIndex(promise => promise.id === id)
    const finishedPromise = this.promises.splice(promiseId, 1)[0]

    if (finishedPromise && finishedPromise.onFinish) {
      finishedPromise.onFinish()
    }

    if (this.promises.length === 0) {
      this.onFinish()
    }

    return true
  }

  _wrap (fn, id, resolve, reject, attempts) {
    let retryCount = 0

    const retry = error => {
      if (retryCount >= attempts) {
        throw error || new Error('Retry attempts exceeded')
      }

      retryCount++
      return this._promised(fn).catch(retry)
    }

    return retry()
      .then(promise => resolve(promise), error => reject(error))
      .then(() => this._next(id))
  }
}

// module.exports = PromiseQueue
