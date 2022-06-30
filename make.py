#!/usr/bin/env python

import sys
# todo set correct path
sys.path.append('../DocumentServer/build_tools/scripts')
import base

base.cmd('npm', ['install'])

#compilation_level = "WHITESPACE_ONLY"
compilation_level = "SIMPLE_OPTIMIZATIONS"
base.cmd("java", ["-jar", "./node_modules/google-closure-compiler-java/compiler.jar", 
                  "--compilation_level", compilation_level,
                  "--js_output_file", "temp.js",
                  "--js", "./store/scripts/code.js"])

code_content = base.readFile("temp.js")

code_content = code_content.replace("\r", "")
code_content = code_content.replace("\n", "")

base.delete_file("temp.js")

base.writeFile("./store/scripts/code_min.js", code_content)