import eslint from '@eslint/js';
import unicorn from 'eslint-plugin-unicorn';
import stylistic from '@stylistic/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
	eslint.configs.recommended,
	unicorn.configs['flat/recommended'],
	{
		plugins: {
			'@stylistic': stylistic
		}
	},
	{
		languageOptions: {
			globals: {
				fetch: 'readonly',
				Buffer: 'readonly',
				URL: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly'
			}
		}
	},
	prettier,
	{
		rules: {
			// Possible Errors:
			'no-await-in-loop': 'error',
			'no-console': 'error',
			'no-loss-of-precision': 'error',
			'no-template-curly-in-string': 'error',
			'no-unreachable': 'error',

			// Best Practices:
			'accessor-pairs': 'error',
			'array-callback-return': 'error',
			'block-scoped-var': 'error',
			'consistent-return': 'error',
			'default-case': 'error',
			eqeqeq: 'error',
			'guard-for-in': 'error',
			'max-classes-per-file': ['error', 1],
			'no-alert': 'error',
			'no-caller': 'error',
			'no-div-regex': 'error',
			'no-else-return': 'error',
			'no-eq-null': 'error',
			'no-eval': 'error',
			'no-extend-native': 'error',
			'no-extra-bind': 'error',
			'no-extra-label': 'error',
			'no-floating-decimal': 'error',
			'no-implicit-globals': 'error',
			'no-implied-eval': 'error',
			'no-invalid-this': 'error',
			'no-iterator': 'error',
			'no-labels': [
				'error',
				{
					allowLoop: true,
					allowSwitch: true
				}
			],
			'no-lone-blocks': 'error',
			'no-loop-func': 'error',
			'no-multi-str': 'error',
			'no-new': 'error',
			'no-new-func': 'error',
			'no-new-wrappers': 'error',
			'no-octal-escape': 'error',
			'no-proto': 'error',
			'no-return-assign': 'error',
			'no-return-await': 'error',
			'no-script-url': 'error',
			'no-self-compare': 'error',
			'no-sequences': 'error',
			'no-throw-literal': 'error',
			'no-unmodified-loop-condition': 'error',
			'no-unused-expressions': 'error',
			'no-useless-call': 'error',
			'no-useless-concat': 'error',
			'no-void': 'error',
			'no-warning-comments': 'warn',
			radix: 'error',
			'wrap-iife': ['error', 'inside'],
			yoda: 'error',

			// Strict Mode:
			strict: ['error', 'global'],

			// Variables:
			'no-label-var': 'error',
			'no-undef-init': 'error',
			'no-unused-vars': 'error',

			// Node.js and CommonJS:
			'callback-return': ['error', ['callback', 'cb', 'next', 'done']],
			'global-require': 'error',
			'handle-callback-err': 'error',
			'no-buffer-constructor': 'error',
			'no-mixed-requires': 'error',
			'no-new-require': 'error',
			'no-path-concat': 'error',
			'no-process-env': 'error',
			'no-process-exit': 'error',
			'no-sync': 'error',

			// Stylistic Issues:
			'array-bracket-spacing': [
				'error',
				'never',
				{
					singleValue: false,
					objectsInArrays: false,
					arraysInArrays: false
				}
			],
			'func-name-matching': [
				'error',
				'always',
				{
					includeCommonJSModuleExports: false
				}
			],
			'line-comment-position': [
				'error',
				{
					position: 'above'
				}
			],
			'lines-between-class-members': ['error', 'always'],
			'max-depth': ['error', 6],
			'max-len': [
				'error',
				80,
				4,
				{
					ignoreComments: false,
					ignoreUrls: true,
					ignorePattern: /^\s*(\/\/|\/\*)\s*eslint/.source
				}
			],
			'max-nested-callbacks': ['error', 4],
			'max-params': ['error', 8],
			'new-cap': 'error',
			'no-bitwise': 'error',
			'no-inline-comments': 'error',
			'no-lonely-if': 'error',
			'no-negated-condition': 'error',
			'no-nested-ternary': 'error',
			'no-new-object': 'error',
			'no-unneeded-ternary': [
				'error',
				{
					defaultAssignment: false
				}
			],
			'one-var': ['error', 'never'],
			'spaced-comment': ['error', 'always'],
			'unicode-bom': ['error', 'never'],

			// ECMAScript 6:
			'arrow-body-style': ['error', 'as-needed'],
			'no-confusing-arrow': [
				'error',
				{
					allowParens: true
				}
			],
			'no-duplicate-imports': [
				'error',
				{
					includeExports: false
				}
			],
			'no-useless-computed-key': 'error',
			'no-useless-rename': [
				'error',
				{
					ignoreDestructuring: false,
					ignoreImport: false,
					ignoreExport: false
				}
			],
			'no-var': 'error',
			'object-shorthand': ['error', 'always'],
			'prefer-arrow-callback': [
				'error',
				{
					allowNamedFunctions: false,
					allowUnboundThis: true
				}
			],
			'prefer-const': 'error',
			'prefer-numeric-literals': 'error',
			'prefer-rest-params': 'error',
			'prefer-spread': 'error',
			'prefer-template': 'error',
			'symbol-description': 'error',

			// Import plugin:
			// 'import/no-deprecated': 'warn',
			// 'import/no-extraneous-dependencies': [
			// 	'error',
			// 	{
			// 		devDependencies: true,
			// 		optionalDependencies: true,
			// 		peerDependencies: true
			// 	}
			// ],
			// 'import/no-unassigned-import': 'error',
			// 'import/order': [
			// 	'warn',
			// 	{
			// 		'newlines-between': 'always'
			// 	}
			// ],

			// Unicorn plugin:
			'unicorn/catch-error-name': 'off',
			'unicorn/explicit-length-check': 'off',
			'unicorn/import-style': 'off',
			'unicorn/no-anonymous-default-export': 'off',
			'unicorn/no-array-callback-reference': 'off',
			'unicorn/no-await-expression-member': 'off',
			'unicorn/no-hex-escape': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-unreadable-array-destructuring': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/prefer-string-replace-all': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/switch-case-braces': 'off',

			// Stylistic plugin:
			'@stylistic/lines-around-comment': [
				'error',
				{
					beforeBlockComment: true,
					allowBlockStart: true,
					allowObjectStart: true,
					allowArrayStart: true,
					allowEnumStart: true,
					allowInterfaceStart: true,
					allowModuleStart: true,
					allowTypeStart: true
				}
			],
			'@stylistic/member-delimiter-style': 'error'
		}
	},
	{
		files: ['**/*.js', '**/*.jsx']
	},
	{
		files: ['bin/*.js', 'bin/*.jsx'],
		languageOptions: {
			globals: {
				console: 'readonly',
				process: 'readonly'
			}
		},
		rules: {
			'no-console': 'off'
		}
	}
];
