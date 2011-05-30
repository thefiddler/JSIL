"use strict";

if (typeof (JSIL) === "undefined")
  throw new Error("JSIL.Core required");

var $jsilxna = JSIL.DeclareAssembly("JSIL.XNACore");

Microsoft.Xna.Framework.Content.ContentManager.prototype._ctor$0 = function (serviceProvider) {
}
Microsoft.Xna.Framework.Content.ContentManager.prototype._ctor$1 = function (serviceProvider, rootDirectory) {
}
Microsoft.Xna.Framework.Content.ContentManager.prototype.Load = function (assetName) {
  return JSIL.Host.getAsset(assetName);
};

JSIL.MakeClass("System.Object", "HTML5Asset", true);
HTML5Asset.prototype._ctor = function (assetName) {
  this.name = assetName;
}

JSIL.MakeClass("HTML5Asset", "HTML5ImageAsset", true);
HTML5ImageAsset.prototype._ctor = function (assetName, image) {
  HTML5Asset.prototype._ctor.call(this, assetName);
  this.image = image;
}

JSIL.MakeClass("HTML5Asset", "HTML5SoundAsset", true);
HTML5SoundAsset.prototype._ctor = function (assetName, sound) {
  HTML5Asset.prototype._ctor.call(this, assetName);
  this.sound = sound;
}

JSIL.MakeClass("HTML5Asset", "HTML5FontAsset", true);
HTML5FontAsset.prototype._ctor = function (assetName, font) {
  HTML5Asset.prototype._ctor.call(this, assetName);
  this.font = font;
}

Microsoft.Xna.Framework.Media.MediaPlayer.Play$0 = function (song) {
  song.sound.play();
};

Microsoft.Xna.Framework.MathHelper.Clamp = function (value, min, max) {
  if (value <= min)
    return min;
  else if (value >= max)
    return max;
  else
    return value;
};

Microsoft.Xna.Framework.Vector2.get_Zero = function () {
  return Object.create(Microsoft.Xna.Framework.Vector2.prototype);
};

Microsoft.Xna.Framework.Vector2.prototype._ctor$0 = function (x, y) {
  this.X = x;
  this.Y = y;
};

Microsoft.Xna.Framework.Vector2.prototype._ctor$1 = function (value) {
  this.X = this.Y = value;
};

Microsoft.Xna.Framework.Vector2.prototype.MemberwiseClone = function () {
  var result = Object.create(Microsoft.Xna.Framework.Vector2.prototype);
  result.X = this.X;
  result.Y = this.Y;
  return result;
}

Microsoft.Xna.Framework.Vector2.op_Addition = function (lhs, rhs) {
  var result = Object.create(Microsoft.Xna.Framework.Vector2.prototype);
  result.X = lhs.X + rhs.X;
  result.Y = lhs.Y + rhs.Y;
  return result;
}

Microsoft.Xna.Framework.Vector2.op_Subtraction = function (lhs, rhs) {
  var result = Object.create(Microsoft.Xna.Framework.Vector2.prototype);
  result.X = lhs.X - rhs.X;
  result.Y = lhs.Y - rhs.Y;
  return result;
}

Microsoft.Xna.Framework.Vector2.op_Multiply$0 = function (lhs, rhs) {
  var result = Object.create(Microsoft.Xna.Framework.Vector2.prototype);
  result.X = lhs.X * rhs.X;
  result.Y = lhs.Y * rhs.Y;
  return result;
}

Microsoft.Xna.Framework.Vector2.op_Multiply$1 = function (lhs, rhs) {
  var result = Object.create(Microsoft.Xna.Framework.Vector2.prototype);
  result.X = lhs.X * rhs;
  result.Y = lhs.Y * rhs;
  return result;
}

Microsoft.Xna.Framework.Vector2.prototype.LengthSquared = function () {
  return (this.X * this.X) + (this.Y * this.Y);
}

Microsoft.Xna.Framework.Vector3.get_Zero = function () {
  return Object.create(Microsoft.Xna.Framework.Vector3.prototype);
};

Microsoft.Xna.Framework.Vector3.prototype._ctor$0 = function (x, y, z) {
  this.X = x;
  this.Y = y;
  this.Z = z;
};

Microsoft.Xna.Framework.Vector3.prototype._ctor$1 = function (value) {
  this.X = this.Y = this.Z = value;
};

Microsoft.Xna.Framework.Vector3.prototype._ctor$2 = function (xy, z) {
  this.X = xy.X;
  this.Y = xy.Y;
  this.Z = z;
};

Microsoft.Xna.Framework.Vector3.prototype.MemberwiseClone = function () {
  var result = Object.create(Microsoft.Xna.Framework.Vector3.prototype);
  result.X = this.X;
  result.Y = this.Y;
  result.Z = this.Z;
  return result;
}

Microsoft.Xna.Framework.Vector4.get_Zero = function () {
  return Object.create(Microsoft.Xna.Framework.Vector4.prototype);
};

Microsoft.Xna.Framework.Vector4.prototype._ctor$0 = function (x, y, z, w) {
  this.X = x;
  this.Y = y;
  this.Z = z;
  this.W = w;
};

Microsoft.Xna.Framework.Vector4.prototype._ctor$1 = function (xy, z, w) {
  this.X = xy.X;
  this.Y = xy.Y;
  this.Z = z;
  this.W = w;
};

Microsoft.Xna.Framework.Vector4.prototype._ctor$2 = function (xyz, w) {
  this.X = xyz.X;
  this.Y = xyz.Y;
  this.Z = xyz.Z;
  this.W = w;
};

Microsoft.Xna.Framework.Vector4.prototype._ctor$3 = function (value) {
  this.X = this.Y = this.Z = this.W = value;
};

Microsoft.Xna.Framework.Vector4.prototype.MemberwiseClone = function () {
  var result = Object.create(Microsoft.Xna.Framework.Vector4.prototype);
  result.X = this.X;
  result.Y = this.Y;
  result.Z = this.Z;
  result.W = this.W;
  return result;
}

Microsoft.Xna.Framework.Game._QuitForced = false;
Microsoft.Xna.Framework.Game.ForceQuit = function () {
  Microsoft.Xna.Framework.Game._QuitForced = true;
};

Microsoft.Xna.Framework.Game.prototype._runHandle = null;
Microsoft.Xna.Framework.Game.prototype._ctor = function () {
  this.content = JSIL.New(Microsoft.Xna.Framework.Content.ContentManager, "_ctor$0", []);
  this._frameDelay = 1000 / 60;

  if (typeof (Date.now) === "function")
    this._GetNow = Date.now;

  if (
    (typeof (window) === "object") &&
    (typeof (window.postMessage) === "function")
  ) {
    var w = window;
    var deferredCalls = [];
    var runDeferredCalls = function () {
      while (deferredCalls.length > 0) {
        var callback = deferredCalls.shift();
        callback();
      }
    };
    var onMessage = function (evt) {
      if (evt.data === "xna_rundeferredcalls")
        runDeferredCalls();
    };
    window.addEventListener("message", onMessage, false);
    this._DeferCall = function (callback, long) {
      if (long) {
        setTimeout(callback, 0);
      } else {
        var needMessage = deferredCalls.length <= 0;
        deferredCalls.push(callback);
        if (needMessage)
          w.postMessage("xna_rundeferredcalls", "*");
      }
    };
  }

  this._gameTime = JSIL.New(Microsoft.Xna.Framework.GameTime, "_ctor$0", []);
  this._lastFrame = this._nextFrame = this._started = this._GetNow();
};
Microsoft.Xna.Framework.Game.prototype.get_Content = function () {
  return this.content;
};
Microsoft.Xna.Framework.Game.prototype.Initialize = function () {
  this.LoadContent();
};
Microsoft.Xna.Framework.Game.prototype.get_GraphicsDevice = function () {
  return this.graphicsDeviceService.GraphicsDevice;
};
Microsoft.Xna.Framework.Game.prototype.LoadContent = function () {
};
Microsoft.Xna.Framework.Game.prototype.UnloadContent = function () {
};
Microsoft.Xna.Framework.Game.prototype.Draw = function (gameTime) {
};
Microsoft.Xna.Framework.Game.prototype.Update = function (gameTime) {
};
Microsoft.Xna.Framework.Game.prototype.Run = function () {
  Microsoft.Xna.Framework.Game._QuitForced = false;
  this.Initialize();
  this._QueueStep();
};
Microsoft.Xna.Framework.Game.prototype._GetNow = function () {
  return (new Date()).getTime();
};
Microsoft.Xna.Framework.Game.prototype._DeferCall = function (callback, long) {
  setTimeout(callback, 0);
};
Microsoft.Xna.Framework.Game.prototype._QueueStep = function () {
  if (Microsoft.Xna.Framework.Game._QuitForced)
    return;

  var self = this;
  var stepCallback = self._Step.bind(self);

  if (typeof (mozRequestAnimationFrame) !== "undefined") {
    mozRequestAnimationFrame(stepCallback);
  } else if (typeof (webkitRequestAnimationFrame) !== "undefined") {
    webkitRequestAnimationFrame(stepCallback);
  } else {
    var shouldStepCallback = function () {
      var now = self._GetNow();
      var delay = self._nextFrame - now;

      if (delay <= 0)
        stepCallback();
      else
        self._DeferCall(shouldStepCallback, delay >= 5);
    };

    // It's important that we use setTimeout at least once after every frame in order to let the browser pump messages
    this._DeferCall(shouldStepCallback, true);
  }
};
Microsoft.Xna.Framework.Game.prototype._Step = function () {
  var now = this._GetNow();
  var elapsed = now - this._lastFrame;
  var total = now - this._started;

  this._lastFrame = now;
  this._nextFrame = now + this._frameDelay;

  this._gameTime.elapsedRealTime._ticks = this._gameTime.elapsedGameTime._ticks = Math.floor(elapsed * System.TimeSpan.MillisecondInTicks);
  this._gameTime.totalRealTime._ticks = this._gameTime.totalGameTime._ticks = Math.floor(total * System.TimeSpan.MillisecondInTicks);

  var failed = true;
  try {
    this.Update(this._gameTime);
    this.Draw(this._gameTime);
    failed = false;
  } finally {
    if (failed || Microsoft.Xna.Framework.Game._QuitForced)
      this.Exit();
    else
      this._QueueStep();
  }
};
Microsoft.Xna.Framework.Game.prototype.Exit = function () {
  this.Dispose();
}
Microsoft.Xna.Framework.Game.prototype.Dispose = function () {
  if (this._runHandle !== null)
    window.clearInterval(this._runHandle);

  this._runHandle = null;
  this.UnloadContent();
}

Microsoft.Xna.Framework.Input.Keyboard.GetState = function (playerIndex) {
  var keys = JSIL.Host.getHeldKeys();
  return new Microsoft.Xna.Framework.Input.KeyboardState(keys);
};

Microsoft.Xna.Framework.Input.KeyboardState.prototype.keys = [];
Microsoft.Xna.Framework.Input.KeyboardState.prototype._ctor = function (keys) {
  // Note that these keys should be represented as raw integral key codes, not enumeration members
  this.keys = keys;
};

Microsoft.Xna.Framework.Input.KeyboardState.prototype.IsKeyDown = function (key) {
  return Array.prototype.indexOf.call(this.keys, key.value) !== -1;
};

Microsoft.Xna.Framework.Input.KeyboardState.prototype.IsKeyUp = function (key) {
  return Array.prototype.indexOf.call(this.keys, key.value) === -1;
};

Microsoft.Xna.Framework.Input.Mouse.GetState = function (playerIndex) {
  var buttons = JSIL.Host.getHeldButtons();
  var position = JSIL.Host.getMousePosition();
  return new Microsoft.Xna.Framework.Input.MouseState(position, buttons);
};

Microsoft.Xna.Framework.Input.GamePad.GetState = function (playerIndex) {
  return new Microsoft.Xna.Framework.Input.GamePadState();
};

Microsoft.Xna.Framework.Input.GamePadState.prototype._ctor = function () {
  this._buttons = new Microsoft.Xna.Framework.Input.GamePadButtons();
  this._thumbs = new Microsoft.Xna.Framework.Input.GamePadThumbSticks();
  this._triggers = new Microsoft.Xna.Framework.Input.GamePadTriggers();
}

Microsoft.Xna.Framework.Input.GamePadState.prototype.get_Buttons = function () {
  return this._buttons;
}

Microsoft.Xna.Framework.Input.GamePadState.prototype.get_ThumbSticks = function () {
  return this._thumbs;
}

Microsoft.Xna.Framework.Input.GamePadState.prototype.get_Triggers = function () {
  return this._triggers;
}

Microsoft.Xna.Framework.Input.GamePadThumbSticks.prototype.get_Left = function () {
  return this._left;
}

Microsoft.Xna.Framework.Input.GamePadThumbSticks.prototype.get_Right = function () {
  return this._right;
}

Microsoft.Xna.Framework.Input.MouseState.prototype._ctor = function (position, buttons) {
  this.position = position;
  this.buttons = buttons;
};

Microsoft.Xna.Framework.GraphicsDeviceManager.prototype._ctor = function () {
  this.device = new Microsoft.Xna.Framework.Graphics.GraphicsDevice();
};

Microsoft.Xna.Framework.GraphicsDeviceManager.prototype.get_GraphicsDevice = function () {
  return this.device;
};

Microsoft.Xna.Framework.Graphics.Viewport.prototype.get_Width = function () {
  return this._width;
}
Microsoft.Xna.Framework.Graphics.Viewport.prototype.get_Height = function () {
  return this._height;
}
Microsoft.Xna.Framework.Graphics.Viewport.prototype.set_Width = function (value) {
  this._width = value;
}
Microsoft.Xna.Framework.Graphics.Viewport.prototype.set_Height = function (value) {
  this._height = value;
}
Microsoft.Xna.Framework.Graphics.Viewport.prototype.get_TitleSafeArea = function () {
  return new Microsoft.Xna.Framework.Rectangle(0, 0, this._width, this._height);
}

Microsoft.Xna.Framework.GameTime.prototype._ctor$0 = function () {
};

Microsoft.Xna.Framework.GameTime.prototype._ctor$1 = function (totalRealTime, elapsedRealTime, totalGameTime, elapsedGameTime, isRunningSlowly) {
  this.totalRealTime = totalRealTime;
  this.elapsedRealTime = elapsedRealTime;
  this.totalGameTime = totalGameTime;
  this.elapsedGameTime = elapsedGameTime;
  this.isRunningSlowly = isRunningSlowly;
};

Microsoft.Xna.Framework.GameTime.prototype._ctor$2 = function (totalRealTime, elapsedRealTime, totalGameTime, elapsedGameTime) {
  Microsoft.Xna.Framework.GameTime.prototype._ctor$1.call(this, totalRealTime, elapsedRealTime, totalGameTime, elapsedGameTime, false);
};

Microsoft.Xna.Framework.GameTime.prototype.get_TotalRealTime = function () {
  return this.totalRealTime;
}
Microsoft.Xna.Framework.GameTime.prototype.get_TotalGameTime = function () {
  return this.totalGameTime;
}
Microsoft.Xna.Framework.GameTime.prototype.get_ElapsedRealTime = function () {
  return this.elapsedRealTime;
}
Microsoft.Xna.Framework.GameTime.prototype.get_ElapsedGameTime = function () {
  return this.elapsedGameTime;
}

Microsoft.Xna.Framework.Rectangle.prototype._ctor = function (x, y, width, height) {
  this.X = x;
  this.Y = y;
  this.Width = width;
  this.Height = height;
}

Microsoft.Xna.Framework.Rectangle.prototype.get_Left = function () {
  return this.X;
}
Microsoft.Xna.Framework.Rectangle.prototype.get_Top = function () {
  return this.Y;
}
Microsoft.Xna.Framework.Rectangle.prototype.get_Right = function () {
  return this.X + this.Width;
}
Microsoft.Xna.Framework.Rectangle.prototype.get_Bottom = function () {
  return this.Y + this.Height;
}
Microsoft.Xna.Framework.Rectangle.prototype.get_Center = function () {
  return new Microsoft.Xna.Framework.Point(
    Math.floor(this.X + (this.Width / 2)),
    Math.floor(this.Y + (this.Height / 2))
  );
}

Microsoft.Xna.Framework.Rectangle.prototype.MemberwiseClone = function () {
  var result = Object.create(Microsoft.Xna.Framework.Rectangle.prototype);
  result.X = this.X;
  result.Y = this.Y;
  result.Width = this.Width;
  result.Height = this.Height;
  return result;
}


Microsoft.Xna.Framework.Point.prototype._ctor = function (x, y) {
  this.X = x;
  this.Y = y;
}
Microsoft.Xna.Framework.Point._cctor = function () {
  Microsoft.Xna.Framework.Point.Zero = new Microsoft.Xna.Framework.Point();
}
Microsoft.Xna.Framework.Point.prototype.Equals$0 = function (rhs) {
  return this.X === rhs.X && this.Y === rhs.Y;
};
Microsoft.Xna.Framework.Point.op_Equality = function (lhs, rhs) {
  return lhs.Equals$0(rhs);
};
Microsoft.Xna.Framework.Point.op_Inequality = function (lhs, rhs) {
  return lhs.X !== rhs.X || lhs.Y !== rhs.Y;
};

Microsoft.Xna.Framework.Storage.StorageContainer.get_TitleLocation = function () {
  return JSIL.Host.getRootDirectory();
};