import sys
import subprocess
import threading
import webbrowser
import os
import time
try:
    import tkinter as tk
    from tkinter import scrolledtext, messagebox
except Exception:
    print("Tkinter is not available. On Windows install Python with tcl/tk support or run the batch runner.")
    raise

PY = sys.executable or 'python'
SERVER_CMD = [PY, os.path.join('tools','py_bridge_server.py')]

class BridgeGUI:
    def __init__(self, root):
        self.root = root
        root.title('Cyberstar — Python Bridge')
        root.geometry('700x480')

        top = tk.Frame(root)
        top.pack(fill='x', padx=8, pady=6)

        self.start_btn = tk.Button(top, text='Start Server', command=self.start)
        self.start_btn.pack(side='left')
        self.stop_btn = tk.Button(top, text='Stop Server', command=self.stop, state='disabled')
        self.stop_btn.pack(side='left', padx=6)
        self.health_btn = tk.Button(top, text='Open Health (browser)', command=self.open_health, state='disabled')
        self.health_btn.pack(side='left')
        tk.Button(top, text='Python.org', command=lambda: webbrowser.open('https://www.python.org/downloads/')).pack(side='right')

        mid = tk.Frame(root)
        mid.pack(fill='both', expand=True, padx=8, pady=(0,6))

        self.log = scrolledtext.ScrolledText(mid, state='disabled', wrap='none')
        self.log.pack(fill='both', expand=True)

        bottom = tk.Frame(root)
        bottom.pack(fill='x', padx=8, pady=(0,6))
        tk.Label(bottom, text='Status:').pack(side='left')
        self.status_lbl = tk.Label(bottom, text='stopped')
        self.status_lbl.pack(side='left')

        self.proc = None
        self._stop_event = threading.Event()

    def start(self):
        if self.proc:
            return
        self._stop_event.clear()
        try:
            # Start the server subprocess
            self.proc = subprocess.Popen(SERVER_CMD, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        except Exception as e:
            messagebox.showerror('Start failed', f'Failed to start bridge: {e}')
            return
        self.start_btn.config(state='disabled')
        self.stop_btn.config(state='normal')
        self.health_btn.config(state='normal')
        self.status_lbl.config(text='starting')
        threading.Thread(target=self._reader_thread, daemon=True).start()

    def stop(self):
        if not self.proc:
            return
        self.status_lbl.config(text='stopping')
        try:
            self.proc.terminate()
        except Exception:
            pass
        self._stop_event.set()
        self.proc = None
        self.start_btn.config(state='normal')
        self.stop_btn.config(state='disabled')
        self.health_btn.config(state='disabled')
        self.status_lbl.config(text='stopped')

    def open_health(self):
        webbrowser.open('http://127.0.0.1:5000/py-bridge/health')

    def _append(self, text):
        self.log.config(state='normal')
        self.log.insert('end', text)
        self.log.see('end')
        self.log.config(state='disabled')

    def _reader_thread(self):
        self.status_lbl.config(text='running')
        try:
            if not self.proc or not self.proc.stdout:
                return
            for line in self.proc.stdout:
                if line is None:
                    break
                self._append(line)
                if self._stop_event.is_set():
                    break
        except Exception as e:
            self._append(f'ERROR reading process output: {e}\n')
        finally:
            # Ensure UI reflects stopped state
            try:
                if self.proc and self.proc.poll() is not None:
                    self._append(f'Process exited with code {self.proc.returncode}\n')
            except Exception:
                pass
            self.proc = None
            self.start_btn.config(state='normal')
            self.stop_btn.config(state='disabled')
            self.health_btn.config(state='disabled')
            self.status_lbl.config(text='stopped')


if __name__ == '__main__':
    root = tk.Tk()
    gui = BridgeGUI(root)
    root.mainloop()
