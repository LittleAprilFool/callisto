import { expect } from 'chai';
import 'mocha';
import { SharedButton } from './sharedButton';

describe('SharedButton Class', () => {

  // can not run this unit test, problem with loading external packages
  it('should return share', () => {
    const foo = new SharedButton();
    expect(foo.button.label).to.equal('Share');
  });

});