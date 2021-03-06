class Interface {
  constructor () {
    this.threads = {}
  }

  /**
   * Asynchronous find several results on db
   * @param {string} table table to search
   * @param {object} where object to find in format {'toFind': 'value'} - example {'id': 'soge__'}
   * @returns {object} results
   */
  async find (table, where) {
    throw Error('function find() is not implemented in ' + this.constructor.name)
  }

  /**
   * Asynchronous find one result on db
   * @param {string} table table to search
   * @param {object} where object to find in format {'toFind': 'value'} - example {'id': 'soge__'}
   * @returns {object} exactly one result
   */
  async findOne (table, where) {
    throw Error('function findOne() is not implemented in ' + this.constructor.name)
  }

  /**
   * Asynchronous insert object into db
   * @param {string} table table to search
   * @param {object} object object to insert
   * @returns {object} created object
   */
  async insert (table, object) {
    throw Error('function insert() is not implemented in ' + this.constructor.name)
  }

  /**
   * Asynchronous remove objects on db
   * @param {string} table table to search
   * @param {object} where object to find in format {'toFind': 'value'} - example {'id': 'soge__'}
   * @returns {object} no. of results deleted
   */
  async remove (table, where) {
    throw Error('function remove() is not implemented in ' + this.constructor.name)
  }

  /**
   * Asynchronous update of object in db
   * @param {string} table table of object to update
   * @param {string} where object to search update
   * @param {object} object object data to update
   * @returns {object} no. of results updated
   */
  async update (table, where, object) {
    throw Error('function update() is not implemented in ' + this.constructor.name)
  }

  /**
   * Asynchronous increment update of object in db
   * @param {string} table table of object to update
   * @param {string} where object to search update
   * @param {object} object object data to update
   * @returns {object} no. of results updated
   */
  async increment (table, where, object) {
    throw Error('function increment() is not implemented in ' + this.constructor.name)
  }

  /**
   * Asynchronous increment update of one object in db
   * @param {string} table table of object to update
   * @param {string} where object to search update
   * @param {object} object object data to update
   * @returns {object} no. of results updated
   */
  async incrementOne (table, where, object) {
    throw Error('function incrementOne() is not implemented in ' + this.constructor.name)
  }
}

module.exports = Interface
