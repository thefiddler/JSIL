"use strict";

if (typeof (JSIL) !== "undefined")
  throw new Error("JSIL.Core included twice");

var JSIL = {
  __FullName__ : "JSIL"
};

if (typeof (Object.create) !== "function") {
  throw new Error("JSIL requires support for ES5 Object.create");
}
if (typeof (Object.defineProperty) !== "function") {
  throw new Error("JSIL requires support for Object.defineProperty");
}

// Safari does not provide Function.prototype.bind, and we need it.
if (typeof (Function.prototype.bind) !== "function") {
  // Implementation from https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind
  Function.prototype.bind = function( obj ) {
    var slice = [].slice,
        args = slice.call(arguments, 1), 
        self = this, 
        nop = function () {}, 
        bound = function () {
          return self.apply( this instanceof nop ? this : ( obj || {} ), 
                              args.concat( slice.call(arguments) ) );    
        };

    nop.prototype = self.prototype;

    bound.prototype = new nop();

    return bound;
  };
}

JSIL.GlobalNamespace = this;

JSIL.PrivateNamespaces = {};
JSIL.AssemblyShortNames = {};
var $private = null;

JSIL.DeclareAssembly = function (assemblyName) {
  var result = JSIL.GetAssembly(assemblyName);

  $private = result;
  return result;
};

JSIL.GetAssembly = function (assemblyName, requireExisting) {
  var existing = JSIL.PrivateNamespaces[assemblyName];
  if (typeof (existing) !== "undefined")
    return existing;

  var shortName = assemblyName;
  var commaPos = shortName.indexOf(",");
  if (commaPos >= 0)
    shortName = shortName.substr(0, commaPos);

  if (typeof (JSIL.AssemblyShortNames[shortName]) !== "undefined") {
    var existingFullName = JSIL.AssemblyShortNames[shortName];
    if ((existingFullName !== null) && (commaPos <= 0)) {
      existing = JSIL.PrivateNamespaces[existingFullName];
      if (typeof (existing) !== "undefined")
        return existing;
    } else if (commaPos >= 0) {
      // Multiple assemblies with the same short name, so disable the mapping.
      JSIL.AssemblyShortNames[shortName] = null;
    }
  } else if (commaPos >= 0) {
    JSIL.AssemblyShortNames[shortName] = assemblyName;
  }

  if (requireExisting)
    return null;

  // Create a new private global namespace for the new assembly
  var result = Object.create(JSIL.GlobalNamespace);

  try {
    Object.defineProperty(result, "toString", {
      configurable: true,
      enumerable: true,
      value: function () {
        return assemblyName;
      }
    });
  } catch (e) {
  }

  try {
    Object.defineProperty(result, "typesByName", {
      configurable: true,
      enumerable: true,
      value: {}
    });
  } catch (e) {
  }

  JSIL.PrivateNamespaces[assemblyName] = result;
  return result;
};


var $jsilcore = JSIL.DeclareAssembly("JSIL.Core");
JSIL.$NextTypeId = 0;
JSIL.$PublicTypes = {};

JSIL.Name = function (name, context) {
  this.humanReadable = String(context) + "::" + String(name);
  this.key = JSIL.EscapeName(String(context)) + "$" + JSIL.EscapeName(String(name));
};
JSIL.Name.prototype.del = function (target) {
  delete target[this.key];
};
JSIL.Name.prototype.get = function (target) {
  return target[this.key];
};
JSIL.Name.prototype.set = function (target, value) {
  return target[this.key] = value;
};
JSIL.Name.prototype.defineProperty = function (target, decl) {
  Object.defineProperty(
    target, this.key, decl
  );
};
JSIL.Name.prototype.toString = function () {
  return this.humanReadable;
};

JSIL.EscapeName = function (name) {
  var underscoreRe = /[\.\/\+]/g;
  var caretRe = /\`/g;
  var ltRe = /\</g;
  var gtRe = /\>/g;
  return name.replace(caretRe, "$$b").replace(underscoreRe, "_").replace(ltRe, "$$l").replace(gtRe, "$$g");
};

JSIL.SplitRegex = new RegExp("[\.]");

JSIL.GetParentName = function (name) {
  var parts = JSIL.SplitName(name);
  return name.substr(0, name.length - (parts[parts.length - 1].length + 1));
};

JSIL.GetLocalName = function (name) {
  var parts = JSIL.SplitName(name);
  return parts[parts.length - 1];
};

JSIL.SplitName = function (name) {
  if (typeof (name) !== "string")
    JSIL.Host.error(new Error("Not a name: " + name));

  return name.split(JSIL.SplitRegex);
};

JSIL.ResolvedName = function (parent, parentName, key, localName, allowInheritance) {
  this.parent = parent;
  this.parentName = parentName;
  this.key = key;
  this.localName = localName;
  this.allowInheritance = allowInheritance;
};
JSIL.ResolvedName.prototype.exists = function () {
  if (this.allowInheritance)
    return typeof(this.parent[this.key]) !== "undefined";
  else
    return this.parent.hasOwnProperty(this.key);
};
JSIL.ResolvedName.prototype.get = function () {
  return this.parent[this.key];
};
JSIL.ResolvedName.prototype.del = function () {
  try {
    delete this.parent[this.key];
  } catch (e) {
  }
};
JSIL.ResolvedName.prototype.set = function (value) {
  try {
    delete this.parent[this.key];
  } catch (e) {
  }

  try {
    this.parent[this.key] = value;
  } catch (e) {
    Object.defineProperty(
      this.parent, this.key, {
        configurable: true, enumerable: true,
        value: value
      }
    );
  }
};
JSIL.ResolvedName.prototype.define = function (declaration) {
  Object.defineProperty(this.parent, this.key, declaration);
};

JSIL.ResolveName = function (root, name, allowInheritance) {
  var parts = JSIL.SplitName(name);
  var current = root;

  if (typeof (root) === "undefined")
    throw new Error("Invalid search root");

  var makeError = function (_key, _current) {
    var namespaceName;
    if (_current === JSIL.GlobalNamespace)
      namespaceName = "<global>";
    else {
      try {
        namespaceName = _current.toString();
      } catch (e) {
        namespaceName = "<unknown>";
      }
    }

    return new Error("Could not find the name '" + _key + "' in the namespace '" + namespaceName + "'.");
  };

  for (var i = 0, l = parts.length - 1; i < l; i++) {
    var key = JSIL.EscapeName(parts[i]);
    var next = current[key];

    if (allowInheritance) {
      if (typeof (next) === "undefined")
        throw makeError(key, current);
    } else {
      if (!current.hasOwnProperty(key))
        throw makeError(key, current);
    }

    current = next;
  }

  var localName = parts[parts.length - 1];
  return new JSIL.ResolvedName(
    current, name.substr(0, name.length - (localName.length + 1)), 
    JSIL.EscapeName(localName), localName, allowInheritance
  );
};

// Must not be used to construct type or interact with members. Only to get a reference to the type for access to type information.
JSIL.GetTypeByName = function (name, assembly) {
  if (assembly !== undefined) {
    var typeFunction = assembly.typesByName[name];
    if (typeof (typeFunction) === "function")
      return typeFunction(false);
  }

  var typeFunction = JSIL.$PublicTypes[name];
  if (typeof (typeFunction) !== "function")
    throw new Error("Type '" + name + "' has not been defined.");

  return typeFunction(false);
};

JSIL.DefineTypeName = function (name, getter, isPublic) {
  if (typeof (getter) !== "function")
    throw new Error("Definition for type name '" + name + "' is not a function");

  if (isPublic) {
    var existing = JSIL.$PublicTypes[name];
    if (typeof (existing) === "function") {
      JSIL.$PublicTypes[name] = function () {
        throw new Error("Type '" + name + "' has multiple public definitions. You must access it through a specific assembly.");
      };
    } else {
      JSIL.$PublicTypes[name] = getter;
    }
  }

  var existing = $private.typesByName[name];
  if (typeof (existing) === "function")
    throw new Error("Type '" + name + "' has already been defined.");

  $private.typesByName[name] = getter;
};

JSIL.DeclareNamespace = function (name, sealed) {
  if (typeof (sealed) === "undefined")
    sealed = true;

  var resolved = JSIL.ResolveName(JSIL.GlobalNamespace, name, true);
  if (!resolved.exists())
    resolved.define({
      enumerable: true,
      configurable: !sealed,
      value: {
        __FullName__: name,
        toString: function () {
          return name;
        }
      }
    });

  var resolved = JSIL.ResolveName($private, name, false);
  if (!resolved.exists())
    resolved.define({
      enumerable: true,
      configurable: !sealed,
      value: {
        __FullName__: name,
        toString: function () {
          return name;
        }
      }
    });
};

JSIL.DeclareNamespace("System");
JSIL.DeclareNamespace("System.Collections");
JSIL.DeclareNamespace("System.Collections.Generic");
JSIL.DeclareNamespace("System.Text");
JSIL.DeclareNamespace("System.Threading");
JSIL.DeclareNamespace("System.Globalization", false);
JSIL.DeclareNamespace("System.Environment", false);
JSIL.DeclareNamespace("System.Runtime", false);
JSIL.DeclareNamespace("System.Runtime.InteropServices", false);
JSIL.DeclareNamespace("System.Reflection", false);

JSIL.DeclareNamespace("JSIL");
JSIL.DeclareNamespace("JSIL.Array");
JSIL.DeclareNamespace("JSIL.Delegate");
JSIL.DeclareNamespace("JSIL.MulticastDelegate");
JSIL.DeclareNamespace("JSIL.Dynamic");

// Hack
JSIL.DeclareNamespace("Property");

// You can change these fields, but you shouldn't need to in practice
JSIL.DeclareNamespace("JSIL.HostType", false);
JSIL.HostType.IsBrowser = (typeof (window) !== "undefined") && (typeof (navigator) !== "undefined");

// Redefine this class at runtime or override its members to change the behavior of JSIL builtins.
JSIL.DeclareNamespace("JSIL.Host", false);

JSIL.Host.getCanvas = function () {
  throw new Error("No canvas implementation");
};

JSIL.Host.logWrite = function (text) {
  if (typeof (console) !== "undefined")
    Function.prototype.apply.call(console.log, console, arguments);
  else if (JSIL.HostType.IsBrowser)
    return;
  else if (typeof (putstr) === "function")
    putstr(text);
};

JSIL.Host.logWriteLine = function (text) {
  if (typeof (console) !== "undefined")
    Function.prototype.apply.call(console.log, console, arguments);
  else if (JSIL.HostType.IsBrowser)
    return;
  else if (typeof (print) === "function")
    print(text);
};

JSIL.Host.warning = function (text) {
  if (typeof (console) !== "undefined")
    Function.prototype.apply.call(console.warn, console, arguments);
  else
    JSIL.Host.logWriteLine(Array.prototype.join.call(arguments, ""));
};

JSIL.Host.error = function (exception, text) {
  var rest = Array.prototype.slice.call(arguments, 1);
  rest.push(exception);

  var stack = null;
  try {
    stack = exception.stack;
  } catch (e) {
    stack = null;
  }

  if ((typeof (stack) !== "undefined") && (stack !== null)) {
    if (stack.indexOf(String(exception)) >= 0)
      rest.pop();

    rest.push(stack);
  }

  if (typeof (console) !== "undefined") {
    Function.prototype.apply.call(console.error, console, rest);
  }

  JSIL.Host.throwException(exception);
};

JSIL.Host.throwException = function (e) {
  throw e;
};

JSIL.Host.warnedAboutRunLater = false;
JSIL.Host.pendingRunLaterItems = [];
JSIL.Host.runLaterCallback = function () {
  var items = JSIL.Host.pendingRunLaterItems;

  while (items.length > 0) {
    var item = items.shift();
    item();
  }
};

// This can fail to run the specified action if the host hasn't implemented it, so you should
//  only use this to run performance improvements, not things you depend on
JSIL.Host.runLater = function (action) {
  if (typeof (setTimeout) === "function") {
    var needEnqueue = JSIL.Host.pendingRunLaterItems.length <= 0;
    JSIL.Host.pendingRunLaterItems.push(action);
    if (needEnqueue)
      setTimeout(JSIL.Host.runLaterCallback, 0);
  }
};

JSIL.UntranslatableNode = function (nodeType) {
  JSIL.Host.error(new Error("An ILAst node of type " + nodeType + " could not be translated."));
};

JSIL.UntranslatableFunction = function (functionName) {
  return function () {
    JSIL.Host.error(new Error("The function '" + functionName + "' could not be translated."));
  };
};

JSIL.UntranslatableInstruction = function (instruction, operand) {
  if (typeof (operand) !== "undefined")
    JSIL.Host.error(new Error("A MSIL instruction of type " + instruction + " with an operand of type " + operand + " could not be translated."));
  else
    JSIL.Host.error(new Error("A MSIL instruction of type " + instruction + " could not be translated."));
};

JSIL.IgnoredMember = function (memberName) {
  JSIL.Host.error(new Error("An attempt was made to reference the member '" + memberName + "', but it was explicitly ignored during translation."));
};

JSIL.RenameFunction = function (name, fn) {
  var decl = {
    value: name,
    enumerable: true,
    configurable: true
  };
  
  Object.defineProperty(fn, "displayName", decl);
  Object.defineProperty(fn, "debugName", decl);

  return fn;
};

JSIL.MakeExternalMemberStub = function (namespaceName, memberName, inheritedMember) {
  var state = {
    alreadyWarned: false
  };

  var result;
  if (typeof (inheritedMember) === "function") {
    result = function () {
      if (!state.alreadyWarned) {
        JSIL.Host.warning("The external method '" + memberName + "' of type '" + namespaceName + "' has not been implemented; calling inherited method.");
        state.alreadyWarned = true;
      }
      return Function.prototype.apply.call(inheritedMember, this, arguments);
    };
  } else {
    result = function () {
      JSIL.Host.error(new Error("The external method '" + memberName + "' of type '" + namespaceName + "' has not been implemented."));
    };
  }

  var fullName = namespaceName + "::" + memberName;
  result = JSIL.RenameFunction(fullName, result);

  result.__IsPlaceholder__ = true;

  return result;
};

JSIL.ImplementExternals = function (namespaceName, isInstance, externals) {
  if (typeof (namespaceName) !== "string") {
    JSIL.Host.error(new Error("ImplementExternals expected name of namespace"));
    return;
  }
  
  var obj = JSIL.AllImplementedExternals[namespaceName];
  if (typeof (obj) !== "object") {
    JSIL.AllImplementedExternals[namespaceName] = obj = {};
  }

  if (obj.__IsInitialized__) {
    JSIL.Host.error(new Error("Type '" + namespaceName + "' already initialized"));
    return;
  }

  var prefix = isInstance ? "instance$" : "";

  for (var k in externals) {
    var external = externals[k];

    if (typeof (external) === "function")
      external = JSIL.RenameFunction(namespaceName + "::" + k, external);

    obj[prefix + k] = external;
  }
};

JSIL.QueueTypeInitializer = function (type, initializer) {
  if (type.__TypeInitialized__) {
    initializer(type);
  } else {
    type.__Initializers__.push(initializer);
  }
};

JSIL.Initialize = function () {
  // Seal all registered names so that their static constructors run on use
  var arn = JSIL.AllRegisteredNames;
  for (var i = 0, l = arn.length; i < l; i++)
    arn[i].sealed = true;
};

JSIL.GenericParameter = function (name, context) {
  this.name = new JSIL.Name(name, context);
  this.__TypeId__ = ++JSIL.$NextTypeId;
};
JSIL.GenericParameter.prototype.get = function (context) {
  if ((typeof (context) !== "object") && (typeof (context) !== "function")) {
    throw new Error("No context provided when resolving generic parameter '" + this.name + "'");
    return JSIL.AnyType;
  }

  return this.name.get(context);
};
JSIL.GenericParameter.prototype.toString = function () {
  return "<Generic Parameter " + this.name.humanReadable + ">";
};

JSIL.TypeRef = function (context, name, genericArguments) {
  if (arguments.length === 1) {
    this.context = null;
    this.typeName = null;
    this.genericArguments = null;
    this.cachedReference = arguments[0];
  } else {
    if (typeof (name) === "string") {
      this.context = context;
      this.typeName = name;
      this.genericArguments = genericArguments || [];
      this.cachedReference = null;
    } else {
      JSIL.Host.error(new Error("Invalid type reference"), context, name);
    }
  }
};
JSIL.TypeRef.prototype.toString = function () {
  if (this.typeName === null)
    return "ref " + JSIL.GetTypeName(this.cachedReference);
  else
    return "ref " + this.typeName;
};
JSIL.TypeRef.prototype.get = function () {
  if (this.cachedReference !== null)
    return this.cachedReference;

  var result = JSIL.ResolveName(this.context, this.typeName, true);
  if (!result.exists())
    throw new Error("The name '" + this.typeName + "' does not exist.");

  this.cachedReference = result.get();

  if (this.genericArguments.length > 0) {
    var ga = this.genericArguments;

    for (var i = 0, l = ga.length; i < l; i++) {
      var arg = ga[i];

      if (typeof (arg) === "string")
        ga[i] = arg = new JSIL.TypeRef(this.context, arg);

      if (typeof (arg) === "object" && Object.getPrototypeOf(arg) === JSIL.TypeRef.prototype)
        ga[i] = arg = arg.get();
    }

    this.cachedReference = this.cachedReference.Of$NoInitialize.apply(this.cachedReference, ga);
  }

  return this.cachedReference;
};

JSIL.DefaultValue = function (type) {
  var typeObject, typePublicInterface;

  if (typeof (type.__Type__) === "object") {
    typeObject = type.__Type__;
    typePublicInterface = type;
  } else if (typeof (type.__PublicInterface__) !== "undefined") {
    typeObject = type;
    typePublicInterface = type.__PublicInterface__;
  }

  if (typeObject.__IsNativeType__ || false) {
    return new typePublicInterface();
  } else if (typeObject.__IsReferenceType__) {
    return null;
  } else {
    return Object.create(typePublicInterface.prototype);
  }
};

JSIL.New = function (type, constructorName, args) {
  var classObject = type;
  var typeObject = type;
  if (typeof (classObject.__Type__) === "object")
    typeObject = classObject.__Type__;

  if (typeObject.__IsNativeType__ || false) {
    var ctor = classObject.prototype[constructorName];
    return ctor.apply(null, args);
  } else {
    var proto = classObject.prototype;
    var result = Object.create(proto);
  }

  if ((typeObject.__TypeInitialized__ || false) === false)
    JSIL.InitializeType(classObject);
  
  JSIL.InitializeStructFields(result, typeObject);

  if (!typeObject.__IsReferenceType__ && (args.length == 0)) {
  } else {
    var ctor = proto[constructorName];
    ctor.apply(result, args);
  }

  return result;
};

JSIL.CloneObject = function (obj) {
  if ((typeof (obj) === "undefined") || (obj === null))
    throw new Error("Cloning a non-object");

  return Object.create(obj);
};

JSIL.AllRegisteredNames = [];
JSIL.AllImplementedExternals = {};

JSIL.RegisterName = function (name, privateNamespace, isPublic, creator, initializer) {
  var privateName = JSIL.ResolveName(privateNamespace, name, false);
  if (isPublic)
    var publicName = JSIL.ResolveName(JSIL.GlobalNamespace, name, true);

  var localName = privateName.localName;

  if (privateName.exists()) {
    JSIL.DuplicateDefinitionWarning(name, false, privateName.get().__CallStack__ || null, privateNamespace);
    return;
  }

  var state = {
    creator: creator,
    initializer: initializer,
    sealed: false,
    value: null,
    constructing: false,
    name: name
  };
  JSIL.AllRegisteredNames.push(state);

  var getter = function (unseal) {
    var result;

    if (state.constructing)
      throw new Error("Recursive construction of type '" + name + "' detected.");

    if (typeof (state.creator) === "function") {
      state.constructing = true;
      var cf = state.creator;

      try {
        result = cf();
        if ((result === null) || ((typeof (result) !== "object") && (typeof (result) !== "function")))
          throw new Error("Invalid result from type creator");

        state.value = result;
      } catch (exc) {
        JSIL.Host.error(exc);
      } finally {
        delete state.creator;
        state.constructing = false;
      }
    } else {
      result = state.value;

      if ((result === null) || ((typeof (result) !== "object") && (typeof (result) !== "function")))
        throw new Error("Type initialization failed");
    }

    if (typeof (state.initializer) === "function") {
      var ifn = state.initializer;
      state.constructing = true;

      try {
        ifn(result);
      } catch (exc) {
        JSIL.Host.error(exc);
      } finally {
        delete state.initializer;
        state.constructing = false;
      }
    }

    if (typeof (unseal) !== "boolean") {
      unseal = true;
    }

    if (state.sealed && unseal) {
      state.sealed = false;

      JSIL.InitializeType(result);

      JSIL.Host.runLater(function () {
        privateName.del();
        privateName.set(result);

        if (isPublic) {
          publicName.del();
          publicName.set(result);
        }
      });
    }

    return result;
  };

  var decl = {
    enumerable: true,
    configurable: true,
    get: getter
  };
  privateName.define(decl);

  if (isPublic)
    publicName.define(decl);

  JSIL.DefineTypeName(name, getter, isPublic);
};

JSIL.ResolveTypeReference = function (typeReference, context) {
  var result = null;

  if (
    typeof (typeReference) === "undefined"
  ) {
    throw new Error("Undefined type reference");
  } else if (
    typeof (typeReference) === "string"
  ) {
    result = JSIL.GetTypeByName(typeReference, context);
  } else if (
    typeof (typeReference) === "object"
  ) {
    if (Object.getPrototypeOf(typeReference) === JSIL.TypeRef.prototype)
      result = typeReference.get();
    else
      result = typeReference;
  } else if (
    typeof (baseType) === "function"
  ) {
    result = typeReference;
  } else {
    result = typeReference;
  }

  if (typeof (result.__Type__) === "object") {
    return [result, result.__Type__];
  } else if (
    typeof (result.__PublicInterface__) !== "undefined"
  ) {
    return [result.__PublicInterface__, result];
  } else {
    return [result, result];
  }
};

JSIL.MakeProto = function (baseType, target, typeName, isReferenceType, assembly) {
  var _ = JSIL.ResolveTypeReference(baseType, assembly);
  var baseTypePublicInterface = _[0];
  var baseTypeObject = _[1];

  var prototype = JSIL.CloneObject(baseTypePublicInterface.prototype);
  prototype.__BaseType__ = baseTypeObject;

  prototype.__ShortName__ = JSIL.GetLocalName(typeName);
  prototype.__FullName__ = typeName;
  prototype.__IsReferenceType__ = Boolean(isReferenceType);

  return prototype;
};

JSIL.MakeNumericType = function (baseType, typeName, isIntegral) {
  JSIL.MakeType(baseType, typeName, false, true);
  var resolved = JSIL.ResolveName(JSIL.GlobalNamespace, typeName, true);
  var publicInterface = resolved.get();
  var typeObject = publicInterface.__Type__;
  typeObject.__IsNumeric__ = true;
  publicInterface.prototype.__IsNumeric__ = true;
  typeObject.__IsIntegral__ = isIntegral;
  publicInterface.prototype.__IsIntegral__ = isIntegral;
};

JSIL.MakeIndirectProperty = function (target, key, source) {
  var getter = function () {
    return source[key];
  };

  var setter = function (value) {
    // Remove the indirect property
    try {
      delete target[key];
    } catch (e) {
    }
    // Set on result instead of self so that the value is unique to this specialized type instance
    target[key] = value;
  };

  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get: getter,
    set: setter
  });
};

JSIL.TypeObjectPrototype = {};
JSIL.TypeObjectPrototype.__GenericArguments__ = [];
JSIL.TypeObjectPrototype.toString = function () {
  return JSIL.GetTypeName(this);
};

JSIL.ResolveGenericTypeReference = function (obj, context) {
  if ((typeof (obj) !== "object") || (obj === null))
    return null;

  if (Object.getPrototypeOf(obj) === JSIL.GenericParameter.prototype) {
    var result = obj.get(context);

    if (
      (typeof (result) === "undefined") ||
      (result === null)
    )
      return obj;

    return JSIL.ResolveGenericTypeReference(result, context);
  } else if (!obj.__IsClosed__) {
    var ga = obj.__GenericArguments__ || [];
    if (ga.length < 1)
      return obj;

    var openType = obj.__OpenType__;
    var openPublicInterface = openType.__PublicInterface__;
    var existingParameters = obj.__GenericArgumentValues__ || [];
    var closedParameters = new Array(existingParameters.length);

    for (var i = 0; i < closedParameters.length; i++) {
      closedParameters[i] = JSIL.ResolveGenericTypeReference(
        existingParameters[i], context
      );

      // Failed to resolve the parameter.
      if (
        (typeof (closedParameters[i]) === "undefined") ||
        (closedParameters[i] === null)
      )
        return obj;
    }

    var result = openPublicInterface.Of.apply(openPublicInterface, closedParameters);
    return result.__Type__;
  }

  return obj;
};

JSIL.FindGenericParameters = function (obj, type, resultList) {
  // Walk through our base types and identify any unresolved generic parameters.
  // This produces a list of parameters that need new values assigned in the target prototype.

  if ((typeof (obj) !== "object") && (typeof (obj) !== "function"))
    throw new Error("Cannot resolve generic parameters of non-object");

  var currentType = type;

  while ((typeof(currentType) !== "undefined") && (currentType !== null)) {
    var localGa = currentType.__GenericArguments__ || [];
    var localFullName = currentType.__FullNameWithoutArguments__ || currentType.__FullName__;

    for (var i = 0, l = localGa.length; i < l; i++) {
      var key = localGa[i];
      var qualifiedName = new JSIL.Name(key, localFullName);
      var value = qualifiedName.get(obj);

      if ((typeof (value) === "object") && (value !== null)) {
        if (Object.getPrototypeOf(value) === JSIL.GenericParameter.prototype) {
          resultList.push([qualifiedName, value]);
        } else if (!value.__IsClosed__) {
          resultList.push([qualifiedName, value]);
        }
      }
    }

    currentType = currentType.__BaseType__;
    if (
      (typeof(currentType) === "object") && 
      (Object.getPrototypeOf(currentType) === JSIL.TypeRef.prototype)
    )
      currentType = currentType.get().__Type__;
  }
};

$jsilcore.$Of$NoInitialize = function () {
  // This whole function would be 100x simpler if you could provide a prototype when constructing a function. Javascript sucks so much.

  var staticClassObject = this;
  var typeObject = this.__Type__;

  var ga = typeObject.__GenericArguments__;
  if (arguments.length != ga.length)
    throw new Error("Invalid number of generic arguments for type '" + JSIL.GetTypeName(this) + "' (got " + arguments.length + ", expected " + ga.length + ")");

  var resolvedArguments = Array.prototype.slice.call(arguments);

  // Ensure that each argument is the public interface of a type (not the type object or a type reference)
  for (var i = 0, l = resolvedArguments.length; i < l; i++) {
    if (typeof (resolvedArguments[i]) !== "undefined") {
      if (Object.getPrototypeOf(resolvedArguments[i]) === JSIL.TypeRef.prototype)
        resolvedArguments[i] = resolvedArguments[i].get().__Type__;
      else if (typeof (resolvedArguments[i].__Type__) !== "undefined")
        resolvedArguments[i] = resolvedArguments[i].__Type__;
    }

    if (typeof(resolvedArguments[i]) === "undefined")
      throw new Error("Undefined passed as generic argument");
    else if (resolvedArguments[i] === null)
      throw new Error("Null passed as generic argument");
  }

  if (typeof (staticClassObject.prototype) !== "undefined") {
    var resolveContext = JSIL.CloneObject(staticClassObject.prototype);
    for (var i = 0; i < resolvedArguments.length; i++) {
      var name = new JSIL.Name(ga[i], typeObject.__FullName__);
      name.set(resolveContext, resolvedArguments[i]);
    }

    for (var i = 0; i < resolvedArguments.length; i++) {
      var resolved = JSIL.ResolveGenericTypeReference(resolvedArguments[i], resolveContext);
      
      if ((resolved !== resolvedArguments[i]) && (resolved !== null)) {
        // console.log("ga[", i, "] ", resolvedArguments[i], " -> ", resolved);
        resolvedArguments[i] = resolved;
      }
    }
  }

  var cacheKey = null;

  for (var i = 0, l = resolvedArguments.length; i < l; i++) {
    var typeId = resolvedArguments[i].__TypeId__;

    if (typeof (typeId) === "undefined")
      throw new Error("Type missing type ID");

    if (i == 0)
      cacheKey = typeId;
    else
      cacheKey += "," + typeId;
  }

  var ofCache = typeObject.__OfCache__;
  if ((typeof (ofCache) === "undefined") || (ofCache === null))
    typeObject.__OfCache__ = ofCache = [];

  // If we do not return the same exact closed type instance from every call to Of(...), derivation checks will fail
  var result = ofCache[cacheKey] || null;

  if (result !== null)
    return result;

  var resultTypeObject = JSIL.CloneObject(typeObject);

  resultTypeObject.__PublicInterface__ = result = function () {
    var ctorArguments = Array.prototype.slice.call(arguments);
    return Function.prototype.apply.call(staticClassObject, this, ctorArguments);
  };
  resultTypeObject.__OpenType__ = typeObject;
  result.__Type__ = resultTypeObject;

  // Prevents recursion when Of is called indirectly during initialization of the new closed type
  ofCache[cacheKey] = result;

  if (typeof (staticClassObject.prototype) !== "undefined") {
    result.prototype = Object.create(staticClassObject.prototype);
    result.prototype.GetType = function () {
      return resultTypeObject;
    };

    var genericParametersToResolve = [];
    JSIL.FindGenericParameters(result.prototype, resultTypeObject, genericParametersToResolve);

    for (var i = 0; i < genericParametersToResolve.length; i++) {
      var qualifiedName = genericParametersToResolve[i][0];
      var value = genericParametersToResolve[i][1];

      var resolved = JSIL.ResolveGenericTypeReference(value, resolveContext);
      
      if ((resolved !== null) && (resolved !== value)) {
        // console.log(qualifiedName.humanReadable, " ", value, " -> ", resolved);
        qualifiedName.defineProperty(
          result.prototype, {
            value: resolved,
            enumerable: true,
            configurable: true
          }
        );
      }
    }
  }

  var ignoredNames = [
    "__Type__", "__TypeInitialized__", "__IsClosed__", "prototype", 
    "Of", "toString", "__FullName__", "__OfCache__", "Of$NoInitialize",
    "GetType"
  ];

  for (var k in staticClassObject) {
    if (ignoredNames.indexOf(k) !== -1)
      continue;

    JSIL.MakeIndirectProperty(result, k, staticClassObject);
  }

  var fullName = typeObject.__FullName__ + "[" + Array.prototype.join.call(resolvedArguments, ", ") + "]";
  result.__TypeId__ = resultTypeObject.__TypeId__ = ++JSIL.$NextTypeId;
  resultTypeObject.__GenericArgumentValues__ = resolvedArguments;
  resultTypeObject.__FullNameWithoutArguments__ = typeObject.__FullName__;
  resultTypeObject.__FullName__ = fullName;
  resultTypeObject.toString = function () {
    return this.__FullName__;
  };
  result.toString = function () {
    return "<" + this.__Type__.__FullName__ + " Public Interface>";
  };
  result.__Self__ = result;

  if (typeof (result.prototype) !== "undefined") {
    result.prototype.__FullName__ = fullName;
  }

  // This is important: It's possible for recursion to cause the initializer to run while we're defining properties.
  // We prevent this from happening by forcing the initialized state to true.
  resultTypeObject.__TypeInitialized__ = true;

  for (var i = 0, l = resolvedArguments.length; i < l; i++) {
    var key = ga[i];
    var name = new JSIL.Name(key, resultTypeObject.__FullNameWithoutArguments__);

    var makeGetter = function (_name) {
      return function () {
        return _name.get(this);
      }
    };

    var decl = {
      configurable: true,
      enumerable: true,
      value: resolvedArguments[i]
    };
    var getterDecl = {
      configurable: true,
      enumerable: true,
      get: makeGetter(name)
    };

    name.defineProperty(result, decl);
    Object.defineProperty(result, key, getterDecl);

    if (typeof (staticClassObject.prototype) !== "undefined") {
      name.defineProperty(result.prototype, decl);
      Object.defineProperty(result.prototype, key, getterDecl);
    }
  }

  // Since .Of() will now be called even for open types, we need to ensure that we flag
  //  the type as open if it has any unresolved generic parameters.
  var isClosed = true;
  for (var i = 0, l = arguments.length; i < l; i++) {
    if (Object.getPrototypeOf(resolvedArguments[i]) === JSIL.GenericParameter.prototype)
      isClosed = false;
    else if (resolvedArguments[i].__IsClosed__ === false)
      isClosed = false;
  }
  resultTypeObject.__IsClosed__ = isClosed;

  JSIL.InstantiateGenericProperties(result);

  // Force the initialized state back to false
  resultTypeObject.__TypeInitialized__ = false;

  return result;
};
$jsilcore.$Of = function () {
  var result = this.Of$NoInitialize.apply(this, arguments);

  // If the outer type is initialized, initialize the inner type.
  if (this.__Type__.__TypeInitialized__)
    JSIL.InitializeType(result);

  return result;
};

JSIL.StaticClassPrototype = {};
JSIL.StaticClassPrototype.toString = function () {
  return JSIL.GetTypeName(JSIL.GetType(this));
};

JSIL.InstantiateGenericProperties = function (obj) {
  var target = obj;

  while (obj !== null) {
    var gps = obj.__GenericProperties__ || [];

    for (var i = 0, l = gps.length; i < l; i++) {
      var gp = gps[i];
      JSIL.MakeProperty(target, gp[0], gp[1], gp[2]);
    }

    obj = Object.getPrototypeOf(obj);
  }
};

( function () {
  var runtimeType = Object.create(JSIL.TypeObjectPrototype);
  runtimeType.__IsReferenceType__ = true;
  runtimeType.IsInterface = false;
  runtimeType.IsEnum = false;
  runtimeType.__TypeInitialized__ = false;
  runtimeType.__LockCount__ = 0;
  runtimeType.__FullName__ = "System.RuntimeType";
  runtimeType.__ShortName__ = "RuntimeType";

  $jsilcore.RuntimeType = runtimeType;
} )();

JSIL.MakeStructFieldInitializer = function (typeObject) {
  var sf = typeObject.__PublicInterface__.prototype.__StructFields__;
  if ((typeof (sf) !== "object") || (sf.length <= 0))
    return null;
  
  var body = [];
  var types = [];
  for (var i = 0, l = sf.length; i < l; i++) {
    var fieldName = sf[i][0];
    var fieldType = sf[i][1];

    body[i] = "target['" + fieldName + "'] = new (types[" + i.toString() + "]);";

    if (typeof (fieldType) === "string")
      types[i] = JSIL.GetTypeByName(fieldType, typeObject.__Context__);
    else if (typeof (fieldType.get) === "function")
      types[i] = fieldType.get();
  }

  var rawFunction = new Function(
    "types", "target", 
    "//@ sourceURL=jsil://structFieldInitializer/" + typeObject.__FullName__ + "\r\n" + body.join("\r\n")
  );
  var boundFunction = rawFunction.bind(null, types);
  boundFunction.__Type__ == typeObject;

  return boundFunction;
};

JSIL.AddStructFields = function (target, fields) {
  var sf;

  if (target.hasOwnProperty("__StructFields__"))
    sf = target.__StructFields__;
  else
    target.__StructFields__ = sf = Array.prototype.slice.call(target.__StructFields__ || []);

  for (var i = 0, l = fields.length; i < l; i++)
    sf.push(fields[i]);
};

JSIL.InitializeStructFields = function (instance, typeObject) {
  var sfi = typeObject.__StructFieldInitializer__;
  if (typeof (sfi) === "undefined")
    typeObject.__StructFieldInitializer__ = sfi = JSIL.MakeStructFieldInitializer(typeObject);
  if (sfi === null)
    return;

  sfi(instance);
};

JSIL.CopyObjectValues = function (source, target) {
  for (var k in source) {
    if (!source.hasOwnProperty(k))
      continue;

    target[k] = source[k];
  }
};

JSIL.CopyMembers = function (source, target) {
  var sf = source.__StructFields__;
  if (typeof (sf) != "object")
    sf = [];

  for (var key in source) {
    if (!source.hasOwnProperty(key))
      continue;

    target[key] = source[key];
  }

  for (var i = 0, l = sf.length; i < l; i++) {
    var fieldName = sf[i][0];
    var value;

    if (
      source.hasOwnProperty(fieldName) &&
      typeof ((value = target[fieldName]).MemberwiseClone) === "function"
    ) {
      target[fieldName] = value.MemberwiseClone();
    }
  }
};

JSIL.InitializeType = function (type) {
  if (typeof (type) === "undefined")
    throw new Error("Type is null");

  var classObject = type;
  var typeObject = type;

  if (typeof (classObject.__Type__) === "object")
    typeObject = classObject.__Type__;

  if (typeObject.__TypeInitialized__ || false)
    return;

  // Not entirely correct, but prevents recursive type initialization
  typeObject.__TypeInitialized__ = true;

  var ti = typeObject.__Initializers__ || [];
  while (ti.length > 0) {
    var initializer = ti.unshift();
    if (typeof (initializer) === "function")
      initializer(type);
  };

  if (typeObject.__IsClosed__) {
    if (typeof (classObject._cctor) == "function") {
      try {
        classObject._cctor();
      } catch (e) {
        JSIL.Host.error(e, "Unhandled exception in static constructor for type " + JSIL.GetTypeName(type) + ": ");
      }
    }

    if (typeof (classObject._cctor2) == "function") {
      try {
        classObject._cctor2();
      } catch (e) {
        JSIL.Host.error(e, "Unhandled exception in static constructor for type " + JSIL.GetTypeName(type) + ": ");
      }
    }
  }

  if (typeof (typeObject.__OfCache__) !== "undefined") {
    var oc = typeObject.__OfCache__;
    for (var k in oc) {
      if (!oc.hasOwnProperty(k))
        continue;

      JSIL.InitializeType(oc[k]);
    }
  }

  if (
    (typeof (type.prototype) !== "undefined") &&
    (typeof (type.prototype.__BaseType__) !== "undefined")
  ) {
    JSIL.InitializeType(type.prototype.__BaseType__);
  }
};

JSIL.ShadowedTypeWarning = function (fullName) {
  JSIL.Host.error(new Error("Type " + fullName + " is shadowed by another type of the same name."));
};

JSIL.DuplicateDefinitionWarning = function (fullName, isPublic, definedWhere, inAssembly) {
  var message = (isPublic ? "Public" : "Private") + " type '" + fullName + "' is already defined";
  if (inAssembly)
    message += " in assembly '" + inAssembly + "'";

  if (definedWhere && (definedWhere !== null)) {
    message += ".\r\nPreviously defined at:\r\n  ";
    message += definedWhere.join("\r\n  ");
  }

  JSIL.Host.error(new Error(message));
};

JSIL.GetFunctionName = function (fn) {
  return fn.name || fn.__name__ || "unknown";
};

JSIL.ApplyExternals = function (publicInterface, fullName) {
  var externals = JSIL.AllImplementedExternals[fullName];
  var instancePrefix = "instance$";

  var hasPrototype = typeof (publicInterface.prototype) === "object";
  var prototype = hasPrototype ? publicInterface.prototype : null;

  for (var k in externals) {
    if (!externals.hasOwnProperty(k))
      continue;

    var target = publicInterface;
    var value = externals[k];
    var key = k;

    if (k.indexOf(instancePrefix) === 0) {
      if (hasPrototype) {
        key = k.replace(instancePrefix, "");
        target = prototype;
      } else {
        JSIL.Host.warning("Type '" + fullName + "' has no prototype to apply instance externals to.");
        continue;
      }
    }

    try {
      delete target[key];
    } catch (e) {
    }

    try {
      target[key] = value;
    } catch (e) {
      Object.defineProperty(
        target, key, {
          enumerable: true,
          configurable: true,
          value: value
        }
      );
    }
  }

  if (externals) {
    externals.__IsInitialized__ = true;
  } else {
    JSIL.AllImplementedExternals[fullName] = {
      __IsInitialized__: true
    };
  }
};

JSIL.MakeExternalType = function (fullName, isPublic) {
  if (typeof (isPublic) === "undefined")
    JSIL.Host.error(new Error("Must specify isPublic"));

  var assembly = $private;

  var state = {
    hasValue: false
  };
  var getter = function () {
    if (state.hasValue)
      return state.value;
    else
      JSIL.Host.error(new Error("The external type '" + fullName + "' has not been implemented."));
  };
  var setter = function (newValue) {
    state.value = newValue;
    state.hasValue = true;
  };
  var definition = { 
    get: getter, set: setter, 
    configurable: true, enumerable: true 
  };

  var privateName = JSIL.ResolveName(assembly, fullName, false);
  if (!privateName.exists())
    privateName.define(definition);

  if (isPublic) {
    var publicName = JSIL.ResolveName(JSIL.GlobalNamespace, fullName, true);

    if (!publicName.exists())
      publicName.define(definition);
  }
};

$jsilcore.$GetRuntimeType = function (context) {
  var runtimeType = JSIL.ResolveName($jsilcore, "System.RuntimeType", true);
  if (runtimeType.exists()) {
    runtimeType = runtimeType.get();
    JSIL.InitializeType(runtimeType);
    return runtimeType.prototype;
  } else {
    runtimeType = $jsilcore.RuntimeType;
  }

  return runtimeType;
};

JSIL.MakeStaticClass = function (fullName, isPublic, genericArguments, initializer) {
  if (typeof (isPublic) === "undefined")
    JSIL.Host.error(new Error("Must specify isPublic"));

  var assembly = $private;
  var localName = JSIL.GetLocalName(fullName);

  var runtimeType = $jsilcore.$GetRuntimeType(assembly);
  var typeObject = JSIL.CloneObject(runtimeType);
  typeObject.__FullName__ = fullName;

  if (typeof (printStackTrace) === "function")
    typeObject.__CallStack__ = printStackTrace();

  typeObject.__BaseType__ = undefined;
  typeObject.__ShortName__ = localName;
  typeObject.__IsStatic__ = true;
  typeObject.__Initializers__ = [];
  typeObject.__TypeInitialized__ = false;
  typeObject.__GenericArguments__ = genericArguments || [];

  var staticClassObject = JSIL.CloneObject(JSIL.StaticClassPrototype);
  staticClassObject.__Type__ = typeObject;
  staticClassObject.__TypeId__ = typeObject.__TypeId__ = ++JSIL.$NextTypeId;
  typeObject.__PublicInterface__ = staticClassObject;

  if (typeObject.__GenericArguments__.length > 0) {
    staticClassObject.Of$NoInitialize = $jsilcore.$Of$NoInitialize.bind(staticClassObject);
    staticClassObject.Of = $jsilcore.$Of.bind(staticClassObject);
    typeObject.__IsClosed__ = false;
  } else {
    typeObject.__IsClosed__ = true;
  }

  for (var i = 0, l = typeObject.__GenericArguments__.length; i < l; i++) {
    var ga = typeObject.__GenericArguments__[i];
    var name = new JSIL.Name(ga, fullName);
    Object.defineProperty(
      staticClassObject, ga, {
        value: name,
        enumerable: true,
        configurable: true
      }
    );
  }

  var creator = function () {
    JSIL.ApplyExternals(staticClassObject, fullName);

    return staticClassObject;
  };

  if (creator) {
    var decl = {
      value: fullName + ".__creator__",
      configurable: true,
      enumerable: true
    };

    Object.defineProperty(creator, "__name__", decl);
    Object.defineProperty(creator, "debugName", decl);
    Object.defineProperty(creator, "displayName", decl);
  }

  var wrappedInitializer = null;

  if (initializer) {
    var decl = {
      value: fullName + ".__initializer__",
      configurable: true,
      enumerable: true
    };

    Object.defineProperty(initializer, "__name__", decl);
    Object.defineProperty(initializer, "debugName", decl);
    Object.defineProperty(initializer, "displayName", decl);

    wrappedInitializer = function (to) {
      var interfaceBuilder = new JSIL.InterfaceBuilder(to.__Type__, to);
      initializer(interfaceBuilder);
    };
  }

  JSIL.RegisterName(fullName, assembly, isPublic, creator, wrappedInitializer);
};

JSIL.MakeType = function (baseType, fullName, isReferenceType, isPublic, genericArguments, initializer) {
  if (typeof (isPublic) === "undefined")
    JSIL.Host.error(new Error("Must specify isPublic"));

  var assembly = $private;
  var localName = JSIL.GetLocalName(fullName);

  var stack = null;
  if (typeof (printStackTrace) === "function")
    stack = printStackTrace();

  var createTypeObject = function () {
    var runtimeType;
    // Since the actual definition for Type/RuntimeType is cyclical, we need to use a stub for them.
    if (["System.Object", "System.Reflection.MemberInfo", "System.Type", "System.RuntimeType"].indexOf(fullName) !== -1)
      runtimeType = $jsilcore.RuntimeType;
    else
      runtimeType = $jsilcore.$GetRuntimeType(assembly);

    var typeObject = JSIL.CloneObject(runtimeType);

    typeObject.__IsArray__ = false;
    typeObject.__Initializers__ = [];
    typeObject.__Interfaces__ = [];
    typeObject.__TypeInitialized__ = false;
    typeObject.__IsNativeType__ = false;
    typeObject.__IsReferenceType__ = isReferenceType;
    typeObject.__Context__ = assembly;
    typeObject.__FullName__ = fullName;
    typeObject.__ShortName__ = localName;
    typeObject.__LockCount__ = 0;
    typeObject.__Members__ = {};
    typeObject.__GenericProperties__ = [];
    typeObject.__GenericArguments__ = genericArguments || [];

    if (stack !== null)
      typeObject.__CallStack__ = stack;

    var staticClassObject = function () {
      var _typeObject = this.GetType();

      if ((_typeObject.__TypeInitialized__ || false) === false)
        JSIL.InitializeType(_typeObject);

      if (_typeObject.__IsClosed__ === false)
        throw new Error("Cannot construct an instance of an open type");

      JSIL.InitializeStructFields(this, _typeObject);

      var args = arguments;
      if (args === null)
        args = [];

      if (!_typeObject.__IsReferenceType__ && (args.length == 0))
        return;

      if (typeof (this._ctor) != "undefined")
        this._ctor.apply(this, args);
    };

    staticClassObject.toString = typeObject.toString = function () {
      return "<" + fullName + " Public Interface>";
    };

    staticClassObject.__TypeId__ = typeObject.__TypeId__ = ++JSIL.$NextTypeId;
    staticClassObject.__Type__ = typeObject;
    staticClassObject.prototype = JSIL.MakeProto(baseType, staticClassObject, fullName, false, assembly);
    staticClassObject.prototype.__ShortName__ = localName;
    staticClassObject.prototype.GetType = function () {
      return typeObject;
    };

    if (typeObject.__GenericArguments__.length > 0) {
      staticClassObject.Of$NoInitialize = $jsilcore.$Of$NoInitialize.bind(staticClassObject);
      staticClassObject.Of = $jsilcore.$Of.bind(staticClassObject);
      typeObject.__IsClosed__ = false;
    } else {
      typeObject.__IsClosed__ = !(baseType.__IsClosed__ === false);
    }

    typeObject.toString = function () {
      return this.__FullName__;
    };

    typeObject.__PublicInterface__ = staticClassObject;

    typeObject.__BaseType__ = JSIL.ResolveTypeReference(baseType, assembly)[1];
    typeObject.IsAssignableFrom = function (typeOfValue) {
      var t = typeOfValue;
      while (typeof (t) !== "undefined") {
        if (t === typeObject)
          return true;

        t = JSIL.GetBaseType(t);
      }

      return false;
    };

    for (var i = 0, l = typeObject.__GenericArguments__.length; i < l; i++) {
      var ga = typeObject.__GenericArguments__[i];
      var name = new JSIL.Name(ga, fullName);
      Object.defineProperty(
        staticClassObject, ga, {
          value: name,
          enumerable: true,
          configurable: true
        }
      );
    }

    JSIL.ApplyExternals(staticClassObject, fullName);

    return staticClassObject;
  };

  var state = [null];
  var getTypeObject = function () {
    if (state[0] === null) {
      state[0] = createTypeObject();
    }

    return state[0];
  };

  if (getTypeObject) {
    var decl = {
      value: fullName + ".__creator__",
      configurable: true,
      enumerable: true
    };

    Object.defineProperty(getTypeObject, "__name__", decl);
    Object.defineProperty(getTypeObject, "debugName", decl);
    Object.defineProperty(getTypeObject, "displayName", decl);
  }

  var wrappedInitializer = null;
  if (initializer) {
    var decl = {
      value: fullName + ".__initializer__",
      configurable: true,
      enumerable: true
    };

    Object.defineProperty(initializer, "__name__", decl);
    Object.defineProperty(initializer, "debugName", decl);
    Object.defineProperty(initializer, "displayName", decl);

    wrappedInitializer = function (to) {
      var interfaceBuilder = new JSIL.InterfaceBuilder(to.__Type__, to);
      initializer(interfaceBuilder);
    };
  }

  JSIL.RegisterName(fullName, assembly, isPublic, getTypeObject, wrappedInitializer);
};

JSIL.MakeClass = function (baseType, fullName, isPublic, genericArguments, initializer) {
  JSIL.MakeType(baseType, fullName, true, isPublic, genericArguments, initializer);
};

JSIL.MakeStruct = function (baseType, fullName, isPublic, genericArguments, initializer) {
  JSIL.MakeType(baseType, fullName, false, isPublic, genericArguments, initializer);
};

JSIL.MakeInterface = function (fullName, isPublic, genericArguments, members, interfaces) {
  var assembly = $private;
  var localName = JSIL.GetLocalName(fullName);

  var callStack = null;
  if (typeof (printStackTrace) === "function")
    callStack = printStackTrace();

  var creator = function () {
    var publicInterface = function () {
      throw new Error("Cannot construct an instance of an interface");
    };

    var runtimeType = $jsilcore.$GetRuntimeType(assembly);
    var typeObject = JSIL.CloneObject(runtimeType);

    publicInterface.__Type__ = typeObject;

    typeObject.__PublicInterface__ = publicInterface;
    typeObject.__CallStack__ = callStack;
    publicInterface.__TypeId__ = typeObject.__TypeId__ = ++JSIL.$NextTypeId;
    typeObject.__Members__ = members;
    typeObject.__ShortName__ = localName;
    typeObject.__Context__ = $private;
    typeObject.__FullName__ = fullName;
    typeObject.__GenericArguments__ = genericArguments || [];
    typeObject.IsInterface = true;
    typeObject.__Interfaces__ = interfaces;

    typeObject.prototype = JSIL.CloneObject(JSIL.Interface.prototype);

    publicInterface.toString = function () {
      return "<" + fullName + " Public Interface>";
    };
    publicInterface.Of$NoInitialize = function () {
      return typeObject;
    };
    publicInterface.Of = function () {
      return typeObject;
    };

    typeObject.IsAssignableFrom = function (typeOfValue) {
      if (typeObject === typeOfValue)
        return true;

      var getInterfaceTypeObject = function (iface) {
        if (typeof (iface) === "undefined") {
          throw new Error("Attempting to resolve undefined interface");
        } else if (typeof (iface) === "string") {
          var resolved = JSIL.ResolveName(
            typeOfValue.__Context__ || JSIL.GlobalNamespace, iface, true
          );
          if (resolved.exists())
            return resolved.get().__Type__;
          else {
            throw new Error("Attempting to resolve undefined interface named '" + iface + "'.");
          }
        } else if ((typeof (iface) === "object") && (typeof (iface.get) === "function")) {
          return iface.get().__Type__;
        }
      };

      var matchInterfacesRecursive = function (iface, needle) {
        if (iface === needle)
          return true;

        if (!JSIL.IsArray(iface.__Interfaces__))
          return false;

        var interfaces = iface.__Interfaces__;
        for (var i = 0; i < interfaces.length; i++) {
          var baseIface = getInterfaceTypeObject(interfaces[i]);

          if (matchInterfacesRecursive(baseIface, needle))
            return true;
        }
        return false;
      };

      if (typeOfValue.IsInterface) {
        if (matchInterfacesRecursive(typeOfValue, typeObject))
          return true;
      }
      else {
        var value = typeOfValue;
        var interfaces = typeOfValue.__Interfaces__;

        while (JSIL.IsArray(interfaces)) {
          for (var i = 0; i < interfaces.length; i++) {
            if (interfaces[i] === typeObject)
              return true;
          }

          value = JSIL.GetBaseType(value);

          if (typeof (value) !== "undefined")
            interfaces = value.__Interfaces__;
        }
      }

      return false;
    };

    return publicInterface;
  };

  JSIL.RegisterName(fullName, $private, isPublic, creator);
};

JSIL.MakeClass("System.ValueType", "System.Enum", true, [], function ($) {
    $.ExternalMembers(true, 
      "_ctor", "CompareTo", "Equals", "GetHashCode", "GetTypeCode", "GetValue", "HasFlag", "IConvertible_ToBoolean", "IConvertible_ToByte", "IConvertible_ToChar", "IConvertible_ToDateTime", "IConvertible_ToDecimal", "IConvertible_ToDouble", "IConvertible_ToInt16", "IConvertible_ToInt32", "IConvertible_ToInt64", "IConvertible_ToSByte", "IConvertible_ToSingle", "IConvertible_ToType", "IConvertible_ToUInt16", "IConvertible_ToUInt32", "IConvertible_ToUInt64", "InternalGetValue", "toString", "ToString$0", "ToString$1", "ToString$2"
    );
    $.ExternalMembers(false, 
      "Format", "GetEnumValues", "GetHashEntry", "GetName", "GetNames", "GetUnderlyingType", "GetValues", "InternalBoxEnum", "InternalCompareTo", "InternalFlagsFormat", "InternalFormat", "InternalFormattedHexString", "InternalGetNames", "InternalGetUnderlyingType", "InternalGetValues", "IsDefined", "Parse$0", "Parse$1", "ToObject$0", "ToObject$1", "ToObject$2", "ToObject$3", "ToObject$4", "ToObject$5", "ToObject$6", "ToObject$7", "ToObject$8", "ToUInt64", "TryParse$b1$0", "TryParse$b1$1", "TryParseEnum"
    );
  }
);

JSIL.MakeEnumValue = function (enumType, value, key) {
  var obj = new Number(value);
  if (key !== null)
    obj.toString = function () {
      return key;
    };
  else
    obj.toString = function () {
      return value.toString();
    };

  obj.GetType = function () {
    return enumType;
  };

  obj.value = value;
  obj.name = key;

  return obj;
};

JSIL.MakeEnum = function (fullName, isPublic, members, isFlagsEnum) {
  var localName = JSIL.GetLocalName(fullName);
  
  var callStack = null;
  if (typeof (printStackTrace) === "function")
    callStack = printStackTrace();

  var context = $private;

  var creator = function () {
    var result = {
      __CallStack__: callStack,
      __FullName__: fullName, 
      FullName: fullName,
      Name: localName,
      IsEnum: true,
      __IsReferenceType__: false,
      __TypeId__: ++JSIL.$NextTypeId,
      __IsFlagsEnum__: isFlagsEnum,
      __ValueToName__: {},
      __Names__: []
    };

    result.__Type__ = result; // HACK

    result.toString = function () {
      return localName;
    };

    result.Of$NoInitialize = function () {
      return result;
    };
    result.Of = function () {
      return result;
    };

    result.CheckType = function (v) {
      if (typeof (v.GetType) === "function") {
        if (v.GetType() === result)
          return true;
      }

      return false;
    };

    return result;
  };

  var initializer = function ($) {
    var asm = JSIL.GetAssembly("mscorlib");
    var enumType = JSIL.GetTypeFromAssembly(asm, "System.Enum");
    var prototype = JSIL.CloneObject(enumType.__PublicInterface__.prototype);
    prototype.__BaseType__ = enumType;
    prototype.__ShortName__ = localName;
    prototype.__FullName__ = fullName;

    $.__BaseType__ = enumType;
    $.prototype = prototype;

    for (var key in members) {
      if (!members.hasOwnProperty(key))
        continue;

      var value = Math.floor(members[key]);

      $.__Names__.push(key);
      $.__ValueToName__[value] = key;
      $[key] = JSIL.MakeEnumValue($, value, key);
    }
  };

  JSIL.RegisterName(fullName, $private, isPublic, creator, initializer);
};

JSIL.MakeInterfaceMemberGetter = function (thisReference, name) {
  return function () {
    return thisReference[name];
  };
};

JSIL.ImplementInterfaces = function (type, interfacesToImplement) {
  var interfaces = type.__Type__.__Interfaces__;
  if (typeof (interfaces) === "undefined") {
    type.__Type__.__Interfaces__ = interfaces = [];
  }

  var typeName = JSIL.GetTypeName(type);
  var missingMembers = [];

  var hasOwnPropertyRecursive = function (target, name) {
    while (!target.hasOwnProperty(name)) {
      target = Object.getPrototypeOf(target);

      if ((typeof (target) === "undefined") || (target === null))
        return false;
    }

    return target.hasOwnProperty(name);
  };

  var getOwnDescriptorRecursive = function (target, name) {
    while (!target.hasOwnProperty(name)) {
      target = Object.getPrototypeOf(target);

      if ((typeof (target) === "undefined") || (target === null))
        return null;
    }

    return Object.getOwnPropertyDescriptor(target, name);
  };

  __interfaces__:
  for (var i = 0, l = interfacesToImplement.length; i < l; i++) {
    var iface = interfacesToImplement[i];

    if (typeof (iface) === "undefined") {
      JSIL.Host.warning("Type ", typeName, " implements an undefined interface.");
      continue __interfaces__;
    } else if (typeof (iface) === "string") {
      var resolved = JSIL.ResolveName(
        type.__Type__.__Context__ || JSIL.GlobalNamespace, iface, true
      );
      if (resolved.exists())
        iface = resolved.get();
      else {
        JSIL.Host.warning("Type ", typeName, " implements an undefined interface named '", iface, "'.");
        continue __interfaces__;
      }
    } else if ((typeof (iface) === "object") && (typeof (iface.get) === "function")) {
      iface = iface.get();
    }

    if (typeof (iface.__Type__) === "object")
      iface = iface.__Type__;

    var ifaceName = JSIL.GetTypeName(iface);
    if (iface.IsInterface !== true) {
      JSIL.Host.warning("Type ", ifaceName, " is not an interface.");
      continue __interfaces__;
    }

    // In cases where an interface method (IInterface_MethodName) is implemented by a regular method
    //  (MethodName), we make a copy of the regular method with the name of the interface method, so
    //  that attempts to directly invoke the interface method will still work.
    var members = iface.__Members__;
    var proto = type.prototype;

    if (
      (ifaceName.indexOf("Enumerator") !== -1) &&
      (typeName.indexOf("Enumerator") !== -1) &&
      (typeName.indexOf("List") !== -1)
    ) {
      ifaceName = ifaceName;
    }

    __members__:
    for (var key in members) {
      if (!members.hasOwnProperty(key))
        continue __members__;

      var memberType = members[key];
      var qualifiedName = JSIL.EscapeName(iface.__ShortName__ + "." + key);

      var hasShort = hasOwnPropertyRecursive(proto, key);
      var hasQualified = hasOwnPropertyRecursive(proto, qualifiedName);

      if (memberType === Function) {
        var shortImpl = proto[key];
        var qualifiedImpl = proto[qualifiedName];
      } else if (memberType === Property) {
        var shortImpl = getOwnDescriptorRecursive(proto, key);
        var qualifiedImpl = getOwnDescriptorRecursive(proto, qualifiedName);
      }

      if ((typeof (shortImpl) === "undefined") || (shortImpl === null))
        hasShort = false;

      if ((typeof (qualifiedImpl) === "undefined") || (qualifiedImpl === null))
        hasQualified = false;

      if (
        hasShort && 
        (typeof(shortImpl.__IsPlaceholder__) !== "undefined") &&
        Boolean(shortImpl.__IsPlaceholder__)
      ) {
        hasShort = false;
      }

      if (
        hasQualified && 
        (typeof(qualifiedImpl.__IsPlaceholder__) !== "undefined") &&
        Boolean(qualifiedImpl.__IsPlaceholder__)
      ) {
        hasQualified = false;
      }

      if (!hasShort && !hasQualified) {
        missingMembers.push(qualifiedName);
        continue __members__;
      }

      if (!hasQualified) {
        if (memberType === Function) {
          Object.defineProperty(proto, qualifiedName, {
            configurable: true,
            enumerable: true,
            get: JSIL.MakeInterfaceMemberGetter(proto, key)
          });
        } else if (memberType === Property) {
          Object.defineProperty(proto, qualifiedName, shortImpl);
        }
      }
    }

    if (interfaces.indexOf(iface) < 0)
      interfaces.push(iface);
  }

  if (missingMembers.length > 0) {
    JSIL.Host.warning("Type ", JSIL.GetTypeName(type), " is missing implementation of interface member(s): ", missingMembers.join(", "));
  }
};

JSIL.CheckDerivation = function (haystack, needle) {
  var proto = haystack;

  while (proto != null) {
    if (proto === needle)
      return true;

    proto = Object.getPrototypeOf(proto);
  }

  return false;
};

JSIL.CheckType = function (value, expectedType, bypassCustomCheckMethod) {
  var expectedTypeObject, expectedTypePublicInterface;

  if (typeof (expectedType) === "undefined") {
    JSIL.Host.warning("Warning: Comparing value against an undefined type: ", value);
    return false;
  }

  if (typeof (expectedType.__Type__) === "object") {
    expectedTypeObject = expectedType.__Type__;
    expectedTypePublicInterface = expectedType;
  } else if (typeof (expectedType.__PublicInterface__) !== "undefined") {
    expectedTypeObject = expectedType;
    expectedTypePublicInterface = expectedType.__PublicInterface__;
  }

  if (typeof (value) === "undefined")
    return false;
  else if (value === null)
    return false;

  if (expectedTypeObject.IsInterface === true) {
    var interfaces = JSIL.GetType(value).__Interfaces__;

    while (JSIL.IsArray(interfaces)) {
      for (var i = 0; i < interfaces.length; i++) {
        if (interfaces[i] === expectedTypeObject)
          return true;
      }

      value = Object.getPrototypeOf(value);
      interfaces = JSIL.GetType(value).__Interfaces__;
    }

    return false;
  } else if (expectedTypeObject.IsEnum === true) {
    return expectedTypePublicInterface.CheckType(value);
  }

  var ct = expectedTypePublicInterface.CheckType;
  if (
    (typeof (ct) != "undefined") &&
    !Boolean(bypassCustomCheckMethod)
  ) {
    if (ct(value))
      return true;
  }

  var expectedProto = expectedTypePublicInterface.prototype;
  if ((typeof (expectedProto) === "undefined") ||
      (typeof (expectedProto) === "null"))
    return false;

  if ((typeof (value) === "object") || (typeof (value) === "function")) {
    if (JSIL.CheckDerivation(Object.getPrototypeOf(value), expectedProto))
      return true;
  }

  return false;
};

JSIL.IsArray = function (value) {
  if ((typeof (value) === "object") && (value !== null)) {
    var valueProto = Object.getPrototypeOf(value);

    if (valueProto === Array.prototype) {
    } else if (typeof (ArrayBuffer) === "function") {
      if ((typeof (value.buffer) === "object") && (Object.getPrototypeOf(value.buffer) === ArrayBuffer.prototype))
        ;
      else
        return false;
    } else {
      return false;
    }

    var length = null;
    try {
      length = value.length;
    } catch (e) {
    }
    if (typeof (length) === "number")
      return true;
  }

  return false;
};

JSIL.GetBaseType = function (typeObject) {  
  var result = typeObject.__BaseType__;
  if (typeof (result) === "string")
    result = JSIL.ResolveName(typeObject.__Context__, result, true);
  if ((typeof (result) !== "undefined") && (typeof (result.get) === "function"))
    result = result.get();
  if ((typeof (result) !== "undefined") && (typeof (result.__Type__) === "object"))
    result = result.__Type__;

  return result;
};

JSIL.GetType = function (value) {
  var result;

  if ((typeof (value) === "object") && (typeof (value.__Type__) === "object") && (Object.getPrototypeOf(value.__Type__) === JSIL.StaticClassPrototype))
    return value.__Type__;

  if ((typeof (value) !== "undefined") && (typeof (value.GetType) === "function"))
    return value.GetType();

  var type = typeof (value);

  switch (type) {
    case "string":
      return System.String;
    case "number":
      return System.Double;
    default:
      if (JSIL.IsArray(value))
        return System.Array;

      break;
  }

  return System.Object;
};

JSIL.GetTypeName = function (value) {
  if (typeof (value) === "undefined")
    return "JavaScript.Undefined";
  else if (value === null)
    return "System.Object";

  var result = value.__FullName__;

  if ((typeof (result) === "undefined") && (typeof (value.prototype) !== "undefined"))
    result = value.prototype.__FullName__;

  if ((typeof (result) === "undefined") && (typeof (value.__Type__) === "object"))
    return value.__Type__.__FullName__;

  if (typeof (result) === "string")
    return result;
  else if (typeof (result) === "undefined")
    result = typeof (value);

  if (result === "string")
    return "System.String";
  else if (result === "number")
    return "System.Double";
  else if (JSIL.IsArray(value))
    return "System.Array";
  else if (result === "object" || result === "undefined")
    return "System.Object";

  return result;
};

JSIL.TryCast = function (value, expectedType) {
  if (expectedType.__IsReferenceType__ === false)
    throw new System.InvalidCastException("Cannot TryCast a value type");

  if (JSIL.CheckType(value, expectedType))
    return value;
  else
    return null;
};

JSIL.Cast = function (value, expectedType) {
  if (value === null) 
    return null;

  if (expectedType.IsEnum) {
    var result = expectedType.__ValueToName__[value];
    if (typeof (result) === "string")
      return expectedType[result];

    result = JSIL.MakeEnumValue(expectedType, value, null);
    return result;
  } else if (JSIL.CheckType(value, expectedType)) {
    // If the user is casting to an integral type like Int32, we need to floor the value since JS stores all numbers as double
    if (JSIL.CheckDerivation(expectedType.prototype, Number.prototype) && (expectedType.prototype.__IsIntegral__)) {
      return Math.floor(value);
    }

    return value;
  } else
    throw new System.InvalidCastException("Unable to cast object of type '" + JSIL.GetTypeName(value) + "' to type '" + JSIL.GetTypeName(expectedType) + "'.");
};

JSIL.Coalesce = function (lhs, rhs) {
  if (lhs == null)
    return rhs;
  else
    return lhs;
};

JSIL.Dynamic.Cast = function (value, expectedType) {
  return value;
};

JSIL.FakeGenericMethod = function (argumentNames, body) {
  var result = function () {
  };
};

JSIL.GenericMethod = function (argumentNames, body) {
  var result = function () {
    if (arguments.length !== argumentNames.length)
      throw new Error("Invalid number of generic arguments for method (got " + arguments.length + ", expected " + argumentNames.length + ")");

    var genericArguments = Array.prototype.slice.call(arguments);
    var outerThis = this;

    // The user might pass in a public interface instead of a type object, so map that to the type object.
    for (var i = 0, l = genericArguments.length; i < l; i++) {
      var ga = genericArguments[i];

      if ((typeof (ga) !== "undefined") && (ga !== null) && (typeof (ga.__Type__) === "object"))
        genericArguments[i] = ga.__Type__;
    }

    var result = function () {
      // concat doesn't work on the raw 'arguments' value :(
      var invokeArguments = genericArguments.concat(
        Array.prototype.slice.call(arguments)
      );

      return body.apply(outerThis, invokeArguments);
    };

    result.call = function (thisReference) {
      // concat doesn't work on the raw 'arguments' value :(
      var invokeArguments = genericArguments.concat(
        Array.prototype.slice.call(arguments, 1)
      );

      return body.apply(thisReference, invokeArguments);
    };

    result.apply = function (thisReference, invokeArguments) {
      invokeArguments = genericArguments.concat(invokeArguments);
      return body.apply(thisReference, invokeArguments);
    };

    return result;
  };

  result.__IsGenericMethod__ = true;
  result.toString = function () {
    return "<Unbound Generic Method>";
  };

  return result;
};

JSIL.InterfaceBuilder = function (typeObject, publicInterface) {
  this.assembly = $private;
  this.typeObject = typeObject;
  this.publicInterface = publicInterface;
  this.namespace = JSIL.GetTypeName(typeObject);

  this.memberDescriptorPrototype = {
    Static: false,
    Public: false,
    SpecialName: false,
    Name: null
  };
};

JSIL.InterfaceBuilder.prototype.ParseDescriptor = function (descriptor, name) {
  var result = Object.create(this.memberDescriptorPrototype);

  result.Static = descriptor.Static || false;
  result.Public = descriptor.Public || false;

  result.Name = name;
  result.SpecialName = (name == "_ctor") || (name == "_cctor");

  Object.defineProperty(result, "Target", {
    configurable: true,
    enumerable: false,
    value: result.Static ? this.publicInterface : this.publicInterface.prototype
  });

  return result;
};

JSIL.InterfaceBuilder.prototype.PushMember = function (type, descriptor, data) {
  var members = this.typeObject.__Members__;
  if (!JSIL.IsArray(members))
    this.typeObject.__Members__ = members = [];

  Array.prototype.push.call(members, [type, descriptor, data]);
};

JSIL.InterfaceBuilder.prototype.ExternalMembers = function (isInstance /*, ...names */) {
  var impl = JSIL.AllImplementedExternals[this.namespace];

  var prefix = isInstance ? "instance$" : "";
  var target = this.publicInterface;

  if (isInstance)
    target = target.prototype;

  if (typeof (impl) !== "object")
    JSIL.AllImplementedExternals[this.namespace] = impl = {};

  for (var i = 1, l = arguments.length; i < l; i++) {
    var memberName = arguments[i];
    var memberValue = target[memberName];
    var newValue = undefined;

    if (impl.hasOwnProperty(prefix + memberName)) {
      newValue = impl[prefix + memberName];
    } else if (!target.hasOwnProperty(memberName)) {
      newValue = JSIL.MakeExternalMemberStub(this.namespace, memberName, memberValue);
    }

    if (newValue !== undefined) {
      try {
        delete target[memberName];
      } catch (e) {
      }

      try {
        target[memberName] = newValue;
      } catch (e) {
        Object.defineProperty(target, memberName, {
          value: newValue, enumerable: true, configurable: true
        });
      }
    }
  }
};

JSIL.InterfaceBuilder.prototype.Constant = function (_descriptor, name, value) {
  var descriptor = this.ParseDescriptor(_descriptor, name);

  var prop = {
    configurable: true,
    enumerable: true,
    value: value
  };

  Object.defineProperty(descriptor.Target, name, prop);
};

JSIL.InterfaceBuilder.prototype.Property = function (_descriptor, name, getter, setter) {
  var descriptor = this.ParseDescriptor(_descriptor, name);

  var prop = {
    configurable: true,
    enumerable: true
  };

  if (typeof (getter) === "function")
    prop["get"] = getter;
  if (typeof (setter) === "function")
    prop["set"] = setter;

  Object.defineProperty(descriptor.Target, name, prop);

  this.PushMember("PropertyInfo", descriptor, null);
};

JSIL.InterfaceBuilder.prototype.GenericProperty = function (_descriptor, name, getter, setter) {
  var descriptor = this.ParseDescriptor(_descriptor, name);

  var props = this.typeObject.__GenericProperties__;
  props.push([name, getter, setter]);
};

JSIL.InterfaceBuilder.prototype.Field = function (_descriptor, fieldName, defaultValue) {
  var descriptor = this.ParseDescriptor(_descriptor, fieldName);

  descriptor.Target[fieldName] = defaultValue;

  this.PushMember("FieldInfo", descriptor, { defaultValue: defaultValue });
};

JSIL.InterfaceBuilder.prototype.Method = function (_descriptor, methodName, overloadIndex, fn) {
  var descriptor = this.ParseDescriptor(_descriptor, methodName);
  var mangledName = methodName;

  if (typeof(overloadIndex) === "number")
    mangledName = methodName + "$" + overloadIndex;
  else if (typeof (overloadIndex) === "function")
    fn = overloadIndex;

  try {
    descriptor.Target[mangledName] = fn;
  } catch (exc) {
    Object.defineProperty(descriptor.Target, "mangledName", {
      value: fn,
      configurable: true,
      enumerable: true
    });
  }

  this.PushMember("MethodInfo", descriptor, { overloadIndex: overloadIndex, mangledName: mangledName });
};

JSIL.InterfaceBuilder.prototype.OverloadedMethod = function (_descriptor, name, overloads, _assembly) {
  var descriptor = this.ParseDescriptor(_descriptor, name);

  var assembly = _assembly || $private;
  var r = JSIL.MakeOverloadResolver(overloads, assembly);

  var result = function () {
    var args = Array.prototype.slice.call(arguments);
    var method = JSIL.FindOverload(type, args, name, r(this));

    if (method === null)
      throw new Error("No overload of '" + name + "' matching the argument list '" + String(args) + "' could be found.");
    else
      return method.apply(this, args);
  };

  result.__MethodName__ = name;
  result.__MethodOverloads__ = overloads;

  JSIL.OverloadedMethodCore(descriptor.Target, name, overloads, result);
};

JSIL.InterfaceBuilder.prototype.OverloadedGenericMethod = function (_descriptor, name, overloads, _assembly) {
  var descriptor = this.ParseDescriptor(_descriptor, name);

  var assembly = _assembly || $private;
  var r = JSIL.MakeOverloadResolver(overloads, assembly);

  var result = function () {
    var genericArguments = Array.prototype.slice.call(arguments);

    return function () {
      var invokeArguments = Array.prototype.slice.call(arguments);
      var method = JSIL.FindOverload(type, invokeArguments, name, r(this));

      if (method === null)
        throw new Error("No overload of '" + name + "<" + genericArguments.join(", ") + ">' matching the argument list '" + String(invokeArguments) + "' could be found.");
      else
        return method.apply(this, genericArguments).apply(this, invokeArguments);
    }.bind(this);
  };

  JSIL.OverloadedMethodCore(descriptor.Target, name, overloads, result);
};

JSIL.FindOverload = function (prototype, args, name, overloads) {
  var l = args.length;

  find_overload:
  for (var i = 0; i < overloads.length; i++) {
    var overloadArgs = overloads[i][1];
    if (overloadArgs.length != l)
      continue find_overload;

    for (var j = 0; j < l; j++) {
      var expectedType = overloadArgs[j];
      var arg = args[j];

      if ((typeof (expectedType) === "undefined") || (expectedType === null)) {
        // Specific types, like generic parameters, resolve to null or undefined.
      } else if (expectedType.__IsReferenceType__ && (arg === null)) {
        // Null is a valid value for any reference type.
      } else if (!JSIL.CheckType(arg, expectedType)) {
        continue find_overload;
      }
    }

    var overloadName = name + "$" + String(overloads[i][0]);
    var overloadMethod;

    if (typeof (overloadName) === "function") {
      overloadMethod = overloadName;
    } else {
      overloadMethod = prototype[overloadName];
      if (typeof (overloadMethod) === "undefined")
        throw new Error("No method named '" + overloadName + "' could be found.");
    }

    return overloadMethod;
  }

  return null;
};

JSIL.MakeOverloadResolver = function (raw, assembly) {
  var state = [null];

  return function (self) {
    if (state[0] !== null)
      return state[0];

    var resolved = new Array();
    for (var i = 0, l = raw.length; i < l; i++) {      
      var names = raw[i][1];
      var types = new Array(names.length);

      for (var j = 0, m = names.length; j < m; j++) {
        var name = names[j];

        if (typeof (name) === "string")
          types[j] = JSIL.GetTypeByName(name, assembly);
        else if (typeof (name.get) === "function")
          types[j] = name.get(self);
        else if (typeof (name) === "function")
          types[j] = name;
        else
          throw new Error("Invalid argument type for overload: " + String(name));
      }

      resolved[i] = new Array(
        raw[i][0], types
      );
    }

    return state[0] = resolved;
  };
};

JSIL.OverloadedMethodCore = function (type, name, overloads, dispatcher) {
  if (overloads.length < 1)
    return type[name] = null;
  else if (overloads.length < 2) {
    var overload = overloads[0][0];
    if (typeof (overload) === "function")
      return type[name] = overload;
    else
      return type[name] = type[overload];
  }

  for (var i = 0; i < overloads.length; i++) {
    if (overloads[i][0] === name)
      throw new Error("Recursive definition of overloaded method " + JSIL.GetTypeName(type) + "." + name);
  }

  Object.defineProperty(
    type, name, {
      configurable: true,
      enumerable: true,
      value: dispatcher
    }
  );
};

JSIL.ImplementExternals(
  "System.Object", false, {
    CheckType: function (value) {
      return (typeof (value) === "object");
    }
  }
);

JSIL.ImplementExternals(
  "System.Object", true, {
    Equals: function (rhs) {
      return this === rhs;
    },
    MemberwiseClone: function () {
      var result = Object.create(Object.getPrototypeOf(this));

      JSIL.CopyMembers(this, result);
      return result;
    },
    __Initialize__: function (initializer) {
      if (JSIL.IsArray(initializer)) {
        JSIL.CollectionInitializer.prototype.Apply.call(initializer, this);
        return this;
      } else if (JSIL.CheckType(initializer, JSIL.CollectionInitializer)) {
        initializer.Apply(this);
        return this;
      }

      for (var key in initializer) {
        if (!initializer.hasOwnProperty(key))
          continue;

        var value = initializer[key];

        if (JSIL.CheckType(value, JSIL.CollectionInitializer)) {
          value.Apply(this[key]);
        } else {
          this[key] = value;
        }
      }

      return this;
    },
    _ctor: function () {
    },
    toString: function ToString() {
      return JSIL.GetTypeName(this);
    }
  }
);

JSIL.MakeClass(Object, "System.Object", true, [], function ($) {
  $.Field({}, "__LockCount__", 0);
  $.Field({}, "__StructField__", []);

  $.ExternalMembers(true, 
    "Equals", "MemberwiseClone", "__Initialize__", 
    "_ctor", "GetType", "toString"
  );
  $.ExternalMembers(false,
    "CheckType"
  );
});

JSIL.ParseTypeName = function (name) {
  var assemblyName = "", typeName = "", parenText = "";
  var genericArguments = [];
  var readingAssemblyName = false;
  var parenDepth = 0;

  for (var i = 0, l = name.length; i < l; i++) {
    var ch = name[i];

    if (ch == ']') {
      parenDepth -= 1;

      if (parenDepth == 0) {
        if (parenText.length > 0) {
          genericArguments.push(JSIL.ParseTypeName(parenText));
        }

        parenText = "";
      } else if (parenText.length > 0) {
        parenText += ch;
      }
    } else if (ch == '[') {
      if ((parenDepth > 0) && (parenText.length > 0))
        parenText += ch;

      parenDepth += 1;
    } else if (ch == ',') {
      if (parenDepth > 0) {
        parenText += ch;
      } else if (readingAssemblyName) {
        assemblyName += ",";
      } else {
        readingAssemblyName = true;
      }
    } else if (parenDepth > 0) {
      parenText += ch;
    } else if (readingAssemblyName) {
      assemblyName += ch;
    } else {
      typeName += ch;
    }
  }

  if (assemblyName.length === 0)
    assemblyName = null;
  else
    assemblyName = assemblyName.trim();

  if (genericArguments.length === 0)
    genericArguments = null;

  var result = {
    assembly: assemblyName,
    type: typeName.trim(),
    genericArguments: genericArguments
  };

  return result;
};

JSIL.GetTypeInternal = function (parsedTypeName, defaultContext, throwOnFail) {
  var context = null;
  if (parsedTypeName.assembly !== null)
    context = JSIL.GetAssembly(parsedTypeName.assembly, true);
  if (context === null)
    context = defaultContext;

  var ga = null;
  if (parsedTypeName.genericArguments !== null) {
    ga = new Array(parsedTypeName.genericArguments.length);

    for (var i = 0, l = ga.length; i < l; i++) {
      ga[i] = JSIL.GetTypeInternal(parsedTypeName.genericArguments[i], defaultContext);
    }
  }

  return JSIL.GetTypeFromAssembly(context, parsedTypeName.type, ga, throwOnFail);
};

JSIL.GetTypeFromAssembly = function (assembly, typeName, genericArguments, throwOnFail) {
  var resolved, result = null;

  try {
    resolved = JSIL.ResolveName(assembly, typeName, true);
  } catch (exc) {
    if (throwOnFail)
      throw exc;
    else
      return null;
  }

  if (resolved.exists()) {
    result = resolved.get();

    if (JSIL.IsArray(genericArguments) && (genericArguments.length > 0))
      result = result.Of.apply(result, genericArguments);
  } else if (throwOnFail) {
    throw new System.TypeLoadException("The type '" + typeName + "' could not be found in the assembly.");
  }

  if (result !== null)
    return result.__Type__;
  else
    return null;
};

JSIL.CreateInstanceOfType = function (type, constructorArguments) {
  var publicInterface = type.__PublicInterface__;
  var instance = JSIL.CloneObject(publicInterface.prototype);
  Function.prototype.apply.call(publicInterface, instance, constructorArguments);
  return instance;
};

JSIL.GetMembersInternal = function (typeObject, flags, memberType) {
  var result = [];

  var allowInherited = (flags & System.Reflection.BindingFlags.DeclaredOnly) == 0;

  var publicOnly = (flags & System.Reflection.BindingFlags.Public) != 0;
  var nonPublicOnly = (flags & System.Reflection.BindingFlags.NonPublic) != 0;
  if (publicOnly && nonPublicOnly)
    publicOnly = nonPublicOnly = false;

  var staticOnly = (flags & System.Reflection.BindingFlags.Static) != 0;
  var instanceOnly = (flags & System.Reflection.BindingFlags.Instance) != 0;
  if (staticOnly && instanceOnly)
    staticOnly = instanceOnly = false;

  var members = [];
  var target = typeObject;

  while (target !== null) {
    var targetMembers = target.__Members__;

    if (!JSIL.IsArray(targetMembers))
      break;

    members = targetMembers.concat(members);

    if (!allowInherited)
      break;

    target = target.__BaseType__;
  }

  for (var i = 0, l = members.length; i < l; i++) {
    var member = members[i];
    var type = member[0];
    var descriptor = member[1];
    var data = member[2];

    // Instance and static constructors are not enumerated like normal methods.
    if (descriptor.SpecialName)
      continue;

    if (publicOnly && !descriptor.Public)
      continue;
    else if (nonPublicOnly && descriptor.Public)
      continue;

    if (staticOnly && !descriptor.Static)
      continue;
    else if (instanceOnly && descriptor.Static)
      continue;

    if ((typeof (memberType) === "string") && (memberType != type))
      continue;

    var parsedTypeName = JSIL.ParseTypeName("System.Reflection." + type);    
    var infoType = JSIL.GetTypeInternal(parsedTypeName, JSIL.GlobalNamespace, true);
    var info = JSIL.CreateInstanceOfType(infoType);

    info.Name = descriptor.Name;
    info.IsPublic = descriptor.Public;
    info.IsStatic = descriptor.Static;

    result.push(info);
  }

  return result;
};

JSIL.ImplementExternals(
  "System.Type", false, {
    GetType$2: function (name) {
      var parsed = JSIL.ParseTypeName(name);
      return JSIL.GetTypeInternal(parsed, JSIL.GlobalNamespace, false);
    },
    op_Equality: function (lhs, rhs) {
      if (lhs === rhs)
        return true;

      return String(lhs) == String(rhs);
    }
  }
);

JSIL.ImplementExternals(
  "System.Type", true, {
    get_Name: function () {
      return JSIL.GetLocalName(this.__FullName__);
    },
    get_FullName: function () {
      return this.__FullName__;
    },
    get_Assembly: function () {
      // FIXME: Probably wrong for nested types.
      return this.__Context__;
    },
    get_Namespace: function () {
      // FIXME: Probably wrong for nested types.
      return JSIL.GetParentName(this.__FullName__);
    },
    toString: function () {
      return this.__FullName__;
    },
    IsSubclassOf: function (type) {
      var needle = type.__PublicInterface__.prototype;
      var haystack = this.__PublicInterface__.prototype;
      return JSIL.CheckDerivation(haystack, needle);
    },
    GetMembers$0: function () {
      return this.GetMembers$1(
        System.Reflection.BindingFlags.Instance | 
        System.Reflection.BindingFlags.Static | 
        System.Reflection.BindingFlags.Public
      );
    },
    GetMembers$1: function (flags) {
      return JSIL.GetMembersInternal(this, flags);
    },
    GetMethods$0: function () {
    	return this.GetMethods$1(
        System.Reflection.BindingFlags.Instance | 
        System.Reflection.BindingFlags.Static | 
        System.Reflection.BindingFlags.Public
      );
    },
    GetMethods$1: function (flags) {
      return JSIL.GetMembersInternal(this, flags, "MethodInfo");
    },
    GetFields$0: function () {
      return this.GetFields$1(
        System.Reflection.BindingFlags.Instance | 
        System.Reflection.BindingFlags.Static | 
        System.Reflection.BindingFlags.Public
      );
    },
    GetFields$1: function (flags) {
      return JSIL.GetFieldsInternal(this, flags, "FieldInfo");
    }
  }
);

JSIL.MakeClass("System.Object", "JSIL.AnyType", true, [], function ($) {
  $.CheckType = function (value) {
    return true;
  };
});
JSIL.MakeClass("System.Object", "JSIL.AnyValueType", true, [], function ($) {
  $.CheckType = function (value) {
    return true;
  };
});

JSIL.MakeClass("System.Object", "JSIL.Reference", true);
JSIL.MakeClass("JSIL.Reference", "JSIL.Variable", true);
JSIL.MakeClass("JSIL.Reference", "JSIL.MemberReference", true);

JSIL.Reference.__ExpectedType__ = System.Object;
JSIL.Reference.Types = {};

JSIL.Reference.Of = function (type) {
  if (typeof (type) === "undefined")
    throw new Error("Undefined reference type");
  
  var elementName = JSIL.GetTypeName(type);
  var compositeType = JSIL.Reference.Types[elementName];

  if (typeof (compositeType) === "undefined") {
    var typeName = "ref " + elementName;
    compositeType = JSIL.CloneObject(JSIL.Reference);
    compositeType.CheckType = function (value) {
      var isReference = JSIL.CheckType(value, JSIL.Reference, true);
      var isRightType = JSIL.CheckType(value.value, type, false);
      if (!isRightType && (type === System.Object) && (value.value === null))
        isRightType = true;
      return isReference && isRightType;
    };
    compositeType.toString = function () {
      return typeName;
    };
    compositeType.prototype = JSIL.MakeProto(JSIL.Reference, compositeType, typeName, true, type.__Context__);
    compositeType.__FullName__ = typeName;
    compositeType.__TypeId__ = ++JSIL.$NextTypeId;
    JSIL.Reference.Types[elementName] = compositeType;
  }

  return compositeType;
};

JSIL.Variable.prototype._ctor = function (value) {
  this.value = value;
};

JSIL.MemberReference.prototype._ctor = function (object, memberName) {
  this.object = object;
  this.memberName = memberName;
};
JSIL.MemberReference.prototype.get_value = function () {
  return this.object[this.memberName];
};
JSIL.MemberReference.prototype.set_value = function (value) {
  this.object[this.memberName] = value;
}
Object.defineProperty(JSIL.MemberReference.prototype, "value", {
  get: JSIL.MemberReference.prototype.get_value,
  set: JSIL.MemberReference.prototype.set_value,
  configurable: false,
  enumerable: false
});

JSIL.MakeClass("System.Object", "JSIL.CollectionInitializer", true);
JSIL.CollectionInitializer.prototype._ctor = function () {
  this.values = Array.prototype.slice.call(arguments);
};
JSIL.CollectionInitializer.prototype.Apply = function (target) {
  var values;

  // This method is designed to support being applied to a regular array as well
  if (this.hasOwnProperty("values"))
    values = this.values;
  else
    values = this;

  for (var i = 0, l = values.length; i < l; i++)
    target.Add.apply(target, values[i]);
};

JSIL.MakeClass("System.Object", "System.ValueType", true);
System.ValueType.prototype.Equals = function (rhs) {
  if (this === rhs)
    return true;

  if ((rhs === null) || (rhs === undefined))
    return false;

  for (var key in this) {
    if (!this.hasOwnProperty(key))
      continue;

    var valueLhs = this[key];
    var valueRhs = rhs[key];

    if ((valueLhs === null) || (valueLhs === undefined)) {
      if (valueLhs !== valueRhs)
        return false;
    } else if (typeof (valueLhs.Equals) === "function") {
      if (!valueLhs.Equals(valueRhs))
        return false;
    } else if (valueLhs !== valueRhs) {
      return false;
    }
  }

  return true;
};

JSIL.Interface = function () { };
JSIL.Interface.prototype = JSIL.MakeProto(Object, JSIL.Interface, "JSIL.Interface", true, $private);
JSIL.Interface.prototype.Of$NoInitialize = function () {
  return this;
};
JSIL.Interface.prototype.Of = function () {
  return this.Of$NoInitialize.apply(this, arguments);
};

JSIL.MakeInterface("System.IDisposable", true, [], {
  "Dispose": Function
});
JSIL.MakeInterface("System.IEquatable`1", true, ["T"], {
  "Equals": Function
});

JSIL.MakeInterface("System.Collections.IEnumerator", true, [], {
  "MoveNext": Function,
  "get_Current": Function,
  "Reset": Function,
  "Current": Property
});
JSIL.MakeInterface("System.Collections.IEnumerable", true, [], {
  "GetEnumerator": Function
});

JSIL.MakeInterface("System.Collections.Generic.IEnumerator`1", true, ["T"], {
  "get_Current": Function,
  "Current": Property
});
JSIL.MakeInterface("System.Collections.Generic.IEnumerable`1", true, ["T"], {
  "GetEnumerator": Function
});

(function () {
  var runtimeType = $jsilcore.$GetRuntimeType($private);

  var publicInterface = $jsilcore.SystemArray = System.Array = function (size) {
    return new Array(size);
  };
  var typeObject = JSIL.CloneObject(runtimeType);

  typeObject.__IsClosed__ = true;
  typeObject.__IsReferenceType__ = true;
  typeObject.__IsArray__ = true;

  publicInterface.prototype = JSIL.MakeProto("System.Object", publicInterface, "System.Array", true, $private);
  publicInterface.prototype.GetLength = function () {
    return this.length;
  };
  publicInterface.prototype.GetLowerBound = function () {
    return 0;
  };
  publicInterface.prototype.GetUpperBound = function () {
    return this.length - 1;
  };

  publicInterface.__Type__ = typeObject;
  typeObject.__TypeId__ = publicInterface.__TypeId__ = ++JSIL.$NextTypeId;
  publicInterface.toString = function () {
    return "<System.Array Public Interface>";
  };
  publicInterface.CheckType = function (value) {
    return JSIL.IsArray(value);
  };

  publicInterface.Types = {};
  publicInterface.Of = function (elementType) {
    if (typeof (elementType) === "undefined")
      throw new Error("Attempting to create an array of an undefined type");

    var elementTypeObject, elementTypePublicInterface;

    if (typeof (elementType.__Type__) === "object") {
      elementTypeObject = elementType.__Type__;
      elementTypePublicInterface = elementType;
    } else if (typeof (elementType.__PublicInterface__) !== "undefined") {
      elementTypeObject = elementType;
      elementTypePublicInterface = elementType.__PublicInterface__;
    }

    var compositePublicInterface = publicInterface.Types[elementTypePublicInterface.__TypeId__];

    if (typeof (compositePublicInterface) === "undefined") {
      var typeName = elementTypeObject.__FullName__ + "[]";

      var compositeTypeObject = JSIL.CloneObject(typeObject);
      compositePublicInterface = function (size) {
        return new Array(size);
      };
      compositePublicInterface.prototype = JSIL.CloneObject(publicInterface.prototype);

      compositePublicInterface.__Type__ = compositeTypeObject;
      compositeTypeObject.__TypeId__ = compositePublicInterface.__TypeId__ = ++JSIL.$NextTypeId;
      compositePublicInterface.CheckType = publicInterface.CheckType;

      compositeTypeObject.__PublicInterface__ = compositePublicInterface;
      compositeTypeObject.__FullName__ = compositeTypeObject.__FullNameWithoutArguments__ = typeName;
      compositeTypeObject.__IsReferenceType__ = true;
      compositeTypeObject.__IsArray__ = true;
      compositeTypeObject.toString = function () {
        return typeName;
      };

      compositePublicInterface.prototype = JSIL.MakeProto(
        publicInterface, compositePublicInterface, typeName, true, elementTypeObject.__Context__
      );
      compositePublicInterface.toString = function () {
        return "<" + typeName + " Public Interface>";
      };

      publicInterface.Types[elementTypePublicInterface.__TypeId__] = compositePublicInterface;
    }

    return compositePublicInterface;
  };

  JSIL.DefineTypeName("System.Array", function () { return publicInterface; }, true);

  JSIL.ImplementExternals("System.Array", false, {
    Of: publicInterface.Of,
    CheckType: publicInterface.CheckType
  });
})();

JSIL.Array.New = function (elementType, sizeOrInitializer) {
  var elementTypeObject, elementTypePublicInterface;

  if (typeof (elementType.__Type__) === "object") {
    elementTypeObject = elementType.__Type__;
    elementTypePublicInterface = elementType;
  } else if (typeof (elementType.__PublicInterface__) !== "undefined") {
    elementTypeObject = elementType;
    elementTypePublicInterface = elementType.__PublicInterface__;
  }

  if (Array.isArray(sizeOrInitializer)) {
    // If non-numeric, assume array initializer
    var result = new Array(sizeOrInitializer.length);
    for (var i = 0; i < sizeOrInitializer.length; i++)
      result[i] = sizeOrInitializer[i];
  } else {
    var size = Number(sizeOrInitializer);
    var result = new Array(size);

    if (elementTypeObject.__IsReferenceType__) {
      for (var i = 0; i < size; i++)
        result[i] = null;
    } else if (elementTypeObject.__IsNumeric__) {
      for (var i = 0; i < size; i++)
        result[i] = 0;
    } else if (elementTypeObject.IsEnum) {
      var defaultValue = elementTypeObject[elementTypeObject.__ValueToName__[0]];

      for (var i = 0; i < size; i++)
        result[i] = defaultValue;
    } else {
      for (var i = 0; i < size; i++)
        result[i] = new elementTypePublicInterface();
    }
  }

  /* Even worse, doing this deoptimizes all uses of the array in TraceMonkey. AUGH
  // Can't do this the right way, because .prototype for arrays in JS is insanely busted
  result.__FullName__ = type.__FullName__ + "[]";
  result.toString = System.Object.prototype.toString;
  */

  return result;
};

JSIL.Array.ShallowCopy = function (destination, source) {
  if (Array.isArray(destination)) {
  } else if (Array.isArray(destination._items)) {
    destination = destination._items;
  } else {
    throw new Error("Destination must be an array");
  }

  if (Array.isArray(source)) {
  } else if (Array.isArray(source._items)) {
    source = source._items;
  } else {
    throw new Error("Source must be an array");
  }

  for (var i = 0, l = Math.min(source.length, destination.length); i < l; i++)
    destination[i] = source[i];
};

JSIL.MultidimensionalArray = function (type, dimensions, initializer) {
  if (dimensions.length < 2)
    throw new Error("Must have at least two dimensions: " + String(dimensions));

  var totalSize = dimensions[0];
  for (var i = 1; i < dimensions.length; i++)
    totalSize *= dimensions[i];

  this._dimensions = dimensions;
  var items = this._items = new Array(totalSize);

  Object.defineProperty(
    this, "length", {
      value: totalSize,
      configurable: true,
      enumerable: true
    }
  );

  var defaultValue = null;
  if (type.__IsNumeric__)
    defaultValue = 0;

  if (JSIL.IsArray(initializer)) {
    JSIL.Array.ShallowCopy(items, initializer);
  } else {
    for (var i = 0; i < totalSize; i++)
      items[i] = defaultValue;
  }

  switch (dimensions.length) {
    case 2:
      var height = this.length0 = dimensions[0];
      var width = this.length1 = dimensions[1];

      Object.defineProperty(
        this, "Get", {
          configurable: true, enumerable: true, value: function Get (y, x) {
            return items[(y * width) + x];
          }
        }
      );
      Object.defineProperty(
        this, "GetReference", {
          configurable: true, enumerable: true, value: function GetReference (y, x) {
            return new JSIL.MemberReference(items, (y * width) + x);
          }
        }
      );
      Object.defineProperty(
        this, "Set", {
          configurable: true, enumerable: true, value: function Set (y, x, value) {
            items[(y * width) + x] = value;
          }
        }
      );
      Object.defineProperty(
        this, "GetLength", {
          configurable: true, enumerable: true, value: function GetLength (i) {
            return dimensions[i];
          }
        }
      );
      Object.defineProperty(
        this, "GetUpperBound", {
          configurable: true, enumerable: true, value: function GetUpperBound (i) {
            return dimensions[i] - 1;
          }
        }
      );
      break;
    case 3:
      var depth = this.length0 = dimensions[0];
      var height = this.length1 = dimensions[1];
      var width = this.length2 = dimensions[2];
      var heightxwidth = height * width;

      Object.defineProperty(
        this, "Get", {
          configurable: true, enumerable: true, value: function Get (z, y, x) {
            return items[(z * heightxwidth) + (y * width) + x];      
          }
        }
      );
      Object.defineProperty(
        this, "GetReference", {
          configurable: true, enumerable: true, value: function GetReference (z, y, x) {
            return new JSIL.MemberReference(items, (z * heightxwidth) + (y * width) + x);
          }
        }
      );
      Object.defineProperty(
        this, "Set", {
          configurable: true, enumerable: true, value: function Set (z, y, x, value) {
            items[(z * heightxwidth) + (y * width) + x] = value;
          }
        }
      );
      Object.defineProperty(
        this, "GetLength", {
          configurable: true, enumerable: true, value: function GetLength (i) {
            return dimensions[i];
          }
        }
      );
      Object.defineProperty(
        this, "GetUpperBound", {
          configurable: true, enumerable: true, value: function GetUpperBound (i) {
            return dimensions[i] - 1;
          }
        }
      );
      break;
  }
};

JSIL.MultidimensionalArray.prototype = JSIL.CloneObject(System.Array.prototype);
JSIL.MultidimensionalArray.prototype.GetLowerBound = function (i) {
  return 0;
};
JSIL.MultidimensionalArray.New = function (type) {
  var initializer = arguments[arguments.length - 1];
  var numDimensions = arguments.length - 1;

  if (JSIL.IsArray(initializer))
    numDimensions -= 1;
  else
    initializer = null;

  if (numDimensions < 1)
    throw new Error("Must provide at least one dimension");
  else if ((numDimensions == 1) && (initializer === null))
    return System.Array.New(type, arguments[1]);

  var dimensions = Array.prototype.slice.call(arguments, 1, 1 + numDimensions);

  if (initializer != null)
    return new JSIL.MultidimensionalArray(type, dimensions, initializer);
  else
    return new JSIL.MultidimensionalArray(type, dimensions);
};

JSIL.MakeDelegate = function (fullName, isPublic, genericArguments) {
  var assembly = $private;
  var localName = JSIL.GetLocalName(fullName);

  var callStack = null;
  if (typeof (printStackTrace) === "function")
    callStack = printStackTrace();

  var creator = function () {
    // Hack around the fact that every delegate type except MulticastDelegate derives from MulticastDelegate
    var delegateType;
    if (fullName === "System.MulticastDelegate") {
      delegateType = JSIL.GetTypeByName("System.Delegate", $jsilcore);
    } else {
      delegateType = JSIL.GetTypeByName("System.MulticastDelegate", $jsilcore);
    }

    var typeObject = Object.create(JSIL.TypeObjectPrototype);

    typeObject.__BaseType__ = delegateType;
    typeObject.__FullName__ = fullName;
    typeObject.__CallStack__ = callStack;
    typeObject.IsEnum = false;

    typeObject.__GenericArguments__ = genericArguments || [];

    var staticClassObject = typeObject.__PublicInterface__ = Object.create(JSIL.StaticClassPrototype);
    staticClassObject.__Type__ = typeObject;

    staticClassObject.CheckType = function (value) {
      if (
        (
          (typeof (value) === "function") ||
          (typeof (value) === "object")
        ) &&
        (typeof (value.GetType) === "function") &&
        (value.GetType() === typeObject)
      )
        return true;

      return false;
    };

    staticClassObject.New = function (object, method) {
      if ((typeof (method) === "undefined") &&
          (typeof (object) === "function")
      ) {
        method = object;
        object = null;

        if (
          (typeof (method.GetType) === "function") &&
          (method.GetType() === typeObject)
        )
          return method;
      }

      var resultDelegate = method.bind(object);
      var self = this;

      resultDelegate.toString = function () {
        return self.__Type__.__FullName__;
      };
      resultDelegate.GetType = function () {
        return self.__Type__;
      };
      resultDelegate.__object__ = object;
      resultDelegate.__method__ = method;

      Object.seal(resultDelegate);
      return resultDelegate;
    };

    staticClassObject.__TypeId__ = typeObject.__TypeId__ = ++JSIL.$NextTypeId;

    if (typeObject.__GenericArguments__.length > 0) {
      staticClassObject.Of$NoInitialize = $jsilcore.$Of$NoInitialize.bind(staticClassObject);
      staticClassObject.Of = $jsilcore.$Of.bind(staticClassObject);
      typeObject.__IsClosed__ = false;
    } else {
      typeObject.__IsClosed__ = true;
    }

    return staticClassObject;
  };

  JSIL.RegisterName(fullName, assembly, isPublic, creator);
};

JSIL.StringToByteArray = function (text) {
  var result = new Array(text.length);
  
  for (var i = 0, l = text.length; i < l; i++)
    result[i] = text.charCodeAt(i) & 0xFF;

  return result;
};

JSIL.StringToCharArray = function (text) {
  var result = new Array(text.length);

  for (var i = 0, l = text.length; i < l; i++)
    result[i] = text[i];

  return result;
};

JSIL.CompareNumbers = function (lhs, rhs) {
  if (lhs > rhs)
    return 1;
  else if (lhs < rhs)
    return -1;
  else
    return 0;
};

JSIL.ImplementExternals(
  "System.Reflection.MemberInfo", true, {
    get_DeclaringType: function () {
      // FIXME
      return new System.Type();
    }
  }
);

JSIL.MakeClass("System.Object", "System.Reflection.MemberInfo", true, [], function ($) {
});

JSIL.MakeClass("System.Reflection.MemberInfo", "System.Reflection.MethodInfo", true, [], function ($) {
});

JSIL.MakeClass("System.Reflection.MemberInfo", "System.Reflection.FieldInfo", true, [], function ($) {
});

JSIL.MakeClass("System.Reflection.MemberInfo", "System.Reflection.EventInfo", true, [], function ($) {
});

JSIL.MakeClass("System.Reflection.MemberInfo", "System.Reflection.PropertyInfo", true, [], function ($) {
});

JSIL.MakeClass("System.Reflection.MemberInfo", "System.Type", true, [], function ($) {
    $.ExternalMembers(true, 
      "_ctor", "_Type_GetIDsOfNames", "_Type_GetTypeInfo", "_Type_GetTypeInfoCount", "_Type_Invoke", "Equals$0", "Equals$1", "FindInterfaces", "FindMembers", "get_Assembly", "get_AssemblyQualifiedName", "get_Attributes", "get_BaseType", "get_ContainsGenericParameters", "get_DeclaringMethod", "get_DeclaringType", "get_FullName", "get_GenericParameterAttributes", "get_GenericParameterPosition", "get_GUID", "get_HasElementType", "get_HasProxyAttribute", "get_IsAbstract", "get_IsAnsiClass", "get_IsArray", "get_IsAutoClass", "get_IsAutoLayout", "get_IsByRef", "get_IsClass", "get_IsCOMObject", "get_IsContextful", "get_IsEnum", "get_IsExplicitLayout", "get_IsGenericParameter", "get_IsGenericType", "get_IsGenericTypeDefinition", "get_IsImport", "get_IsInterface", "get_IsLayoutSequential", "get_IsMarshalByRef", "get_IsNested", "get_IsNestedAssembly", "get_IsNestedFamANDAssem", "get_IsNestedFamily", "get_IsNestedFamORAssem", "get_IsNestedPrivate", "get_IsNestedPublic", "get_IsNotPublic", "get_IsPointer", "get_IsPrimitive", "get_IsPublic", "get_IsSealed", "get_IsSerializable", "get_IsSpecialName", "get_IsSzArray", "get_IsUnicodeClass", "get_IsValueType", "get_IsVisible", "get_MemberType", "get_Module", "get_Namespace", "get_ReflectedType", "get_StructLayoutAttribute", "get_TypeHandle", "get_TypeInitializer", "get_UnderlyingSystemType", "GetArrayRank", "GetAttributeFlagsImpl", "GetConstructor$0", "GetConstructor$1", "GetConstructor$2", "GetConstructorImpl", "GetConstructors$0", "GetConstructors$1", "GetDefaultMemberName", "GetDefaultMembers", "GetElementType", "GetEvent$0", "GetEvent$1", "GetEvents$0", "GetEvents$1", "GetField$0", "GetField$1", "GetFields$0", "GetFields$1", "GetGenericArguments", "GetGenericParameterConstraints", "GetGenericTypeDefinition", "GetHashCode", "GetInterface$0", "GetInterface$1", "GetInterfaceMap", "GetInterfaces", "GetMember$0", "GetMember$1", "GetMember$2", "GetMembers$0", "GetMembers$1", "GetMethod$0", "GetMethod$1", "GetMethod$2", "GetMethod$3", "GetMethod$4", "GetMethod$5", "GetMethodImpl", "GetMethods$0", "GetMethods$1", "GetNestedType$0", "GetNestedType$1", "GetNestedTypes$0", "GetNestedTypes$1", "GetProperties$0", "GetProperties$1", "GetProperty$0", "GetProperty$1", "GetProperty$2", "GetProperty$3", "GetProperty$4", "GetProperty$5", "GetProperty$6", "GetPropertyImpl", "GetRootElementType", "GetType", "GetTypeCodeInternal", "GetTypeHandleInternal", "HasElementTypeImpl", "HasProxyAttributeImpl", "InvokeMember$0", "InvokeMember$1", "InvokeMember$2", "IsArrayImpl", "IsAssignableFrom", "IsByRefImpl", "IsCOMObjectImpl", "IsContextfulImpl", "IsInstanceOfType", "IsMarshalByRefImpl", "IsPointerImpl", "IsPrimitiveImpl", "IsSubclassOf", "IsValueTypeImpl", "MakeArrayType$0", "MakeArrayType$1", "MakeByRefType", "MakeGenericType", "MakePointerType", "QuickSerializationCastCheck", "SigToString", "toString"
    );

    $.OverloadedMethod({Public: true , Static: false}, "GetConstructors", [
        [0, []], 
        [1, ["System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetMethod", [
        [0, ["System.String", "System.Reflection.BindingFlags", "System.Reflection.Binder", "System.Reflection.CallingConventions", "System.Array" /* System.Type[] */ , "System.Array" /* System.Reflection.ParameterModifier[] */ ]], 
        [1, ["System.String", "System.Reflection.BindingFlags", "System.Reflection.Binder", "System.Array" /* System.Type[] */ , "System.Array" /* System.Reflection.ParameterModifier[] */ ]], 
        [2, ["System.String", "System.Array" /* System.Type[] */ , "System.Array" /* System.Reflection.ParameterModifier[] */ ]], 
        [3, ["System.String", "System.Array" /* System.Type[] */ ]], 
        [4, ["System.String", "System.Reflection.BindingFlags"]], 
        [5, ["System.String"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetMethods", [
        [0, []], 
        [1, ["System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetField", [
        [0, ["System.String", "System.Reflection.BindingFlags"]], 
        [1, ["System.String"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetFields", [
        [0, []], 
        [1, ["System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetInterface", [
        [0, ["System.String"]], 
        [1, ["System.String", "System.Boolean"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetEvent", [
        [0, ["System.String"]], 
        [1, ["System.String", "System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetEvents", [
        [0, []], 
        [1, ["System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetProperty", [
        [0, ["System.String", "System.Reflection.BindingFlags", "System.Reflection.Binder", "System.Type", "System.Array" /* System.Type[] */ , "System.Array" /* System.Reflection.ParameterModifier[] */ ]], 
        [1, ["System.String", "System.Type", "System.Array" /* System.Type[] */ , "System.Array" /* System.Reflection.ParameterModifier[] */ ]], 
        [2, ["System.String", "System.Reflection.BindingFlags"]], 
        [3, ["System.String", "System.Type", "System.Array" /* System.Type[] */ ]], 
        [4, ["System.String", "System.Array" /* System.Type[] */ ]], 
        [5, ["System.String", "System.Type"]], 
        [6, ["System.String"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetProperties", [
        [0, ["System.Reflection.BindingFlags"]], 
        [1, []]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetNestedTypes", [
        [0, []], 
        [1, ["System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetNestedType", [
        [0, ["System.String"]], 
        [1, ["System.String", "System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetMember", [
        [0, ["System.String"]], 
        [1, ["System.String", "System.Reflection.BindingFlags"]], 
        [2, ["System.String", "System.Reflection.MemberTypes", "System.Reflection.BindingFlags"]]
      ], $jsilcore);
    $.OverloadedMethod({Public: true , Static: false}, "GetMembers", [
        [0, []], 
        [1, ["System.Reflection.BindingFlags"]]
      ], $jsilcore);

    $.Property({Public: true , Static: false}, "Name");
    $.Property({Public: true , Static: false}, "Module");
    $.Property({Public: true , Static: false}, "Assembly");
    $.Property({Public: true , Static: false}, "FullName");
    $.Property({Public: true , Static: false}, "Namespace");
    $.Property({Public: true , Static: false}, "BaseType");
});

JSIL.MakeClass("System.Type", "System.RuntimeType", false, [], function ($) {
});