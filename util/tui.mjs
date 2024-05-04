export class Progress {
	constructor(items, stream = process.stdout) {
		this.items = [...items];
		this.stream = stream;
		this.interval = null;
		this._update = null;
	}

	// eslint-disable-next-line no-unused-vars
	line(item) {
		throw new Error('Must override in subclass');
	}

	start(interval) {
		if (this.interval) {
			throw new Error('Already started');
		}

		const {items, stream} = this;
		const {isTTY} = stream;

		let clear = '';
		const update = (this._update = () => {
			let output = clear;
			for (const item of items) {
				output += `${this.line(item)}\n`;
			}
			stream.write(output);
		});

		update();

		clear = isTTY ? '\x1B[F\x1B[2K'.repeat(items.length) : '';
		this.interval = setInterval(update, interval);
	}

	stop() {
		const {interval} = this;
		if (!interval) {
			throw new Error('Not started');
		}

		clearInterval(interval);
		this.interval = null;
		this._update = null;
	}

	end() {
		const {_update: update} = this;
		this.stop();
		update();
	}
}
